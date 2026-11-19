package com.ronki.playgames;

import android.app.Activity;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.games.AuthenticationResult;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.Player;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import com.google.android.gms.tasks.Task;

import java.nio.charset.StandardCharsets;

/**
 * Google Play Games Services v2: sign-in and one saved game (snapshot) holding the profile JSON.
 * Every method resolves or rejects; nothing here may crash the app. Error codes (call.reject(message, code)):
 * NOT_AUTHENTICATED, NOT_CONFIGURED, NETWORK, CONFLICT, UNKNOWN.
 */
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {

    private static final String TAG = "PlayGames";
    private static final String APP_ID_KEY = "com.google.android.gms.games.APP_ID";
    private static final int MAX_CONFLICT_ROUNDS = 3;

    private boolean configured = false;
    private boolean initialized = false;

    @Override
    public void load() {
        initSdk();
    }

    /** Reads the APP_ID meta-data; "0" or empty = not configured (CI had no PLAY_GAMES_APP_ID). */
    private void initSdk() {
        if (initialized) return;
        try {
            Context ctx = getContext();
            ApplicationInfo ai = ctx.getPackageManager().getApplicationInfo(ctx.getPackageName(), PackageManager.GET_META_DATA);
            Bundle md = ai.metaData;
            Object v = md != null ? md.get(APP_ID_KEY) : null;
            String id = v != null ? String.valueOf(v).trim() : "";
            configured = !id.isEmpty() && !"0".equals(id);
            if (configured) {
                PlayGamesSdk.initialize(ctx);
                initialized = true;
            } else {
                Log.i(TAG, "Play Games App ID not set: cloud save off");
            }
        } catch (Exception e) {
            configured = false;
            Log.w(TAG, "Play Games init failed", e);
        }
    }

    /** Returns the activity, or rejects the call and returns null when Play Games cannot be used. */
    private Activity ready(PluginCall call) {
        if (!configured || !initialized) {
            call.reject("Play Games Services are not configured in this build", "NOT_CONFIGURED");
            return null;
        }
        Activity a = getActivity();
        if (a == null) {
            call.reject("No activity", "UNKNOWN");
            return null;
        }
        return a;
    }

    private static String codeFor(Exception e) {
        if (e instanceof ApiException) {
            int s = ((ApiException) e).getStatusCode();
            if (s == CommonStatusCodes.SIGN_IN_REQUIRED) return "NOT_AUTHENTICATED";
            if (s == CommonStatusCodes.NETWORK_ERROR || s == CommonStatusCodes.TIMEOUT) return "NETWORK";
            if (s == CommonStatusCodes.DEVELOPER_ERROR) return "NOT_CONFIGURED";
        }
        return "UNKNOWN";
    }

    private static void fail(PluginCall call, Exception e) {
        String msg = e != null && e.getMessage() != null ? e.getMessage() : "Play Games call failed";
        call.reject(msg, codeFor(e), e);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        initSdk();
        JSObject ret = new JSObject();
        ret.put("available", configured && initialized);
        call.resolve(ret);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", configured && initialized);
        call.resolve(ret);
    }

    // ---- sign-in -------------------------------------------------------------------------------------------------

    @PluginMethod
    public void isAuthenticated(PluginCall call) {
        Activity a = ready(call);
        if (a == null) return;
        try {
            GamesSignInClient client = PlayGames.getGamesSignInClient(a);
            client.isAuthenticated().addOnCompleteListener(task -> onAuthResult(call, a, task));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        Activity a = ready(call);
        if (a == null) return;
        try {
            GamesSignInClient client = PlayGames.getGamesSignInClient(a);
            client.signIn().addOnCompleteListener(task -> onAuthResult(call, a, task));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    private void onAuthResult(PluginCall call, Activity a, Task<AuthenticationResult> task) {
        if (!task.isSuccessful()) {
            fail(call, task.getException());
            return;
        }
        AuthenticationResult r = task.getResult();
        if (r == null || !r.isAuthenticated()) {
            JSObject ret = new JSObject();
            ret.put("available", true);
            ret.put("authenticated", false);
            call.resolve(ret);
            return;
        }
        try {
            PlayGames.getPlayersClient(a).getCurrentPlayer().addOnCompleteListener(pt -> {
                JSObject ret = new JSObject();
                ret.put("available", true);
                ret.put("authenticated", true);
                if (pt.isSuccessful() && pt.getResult() != null) {
                    Player p = pt.getResult();
                    ret.put("playerId", p.getPlayerId());
                    ret.put("displayName", p.getDisplayName());
                }
                call.resolve(ret);
            });
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("available", true);
            ret.put("authenticated", true);
            call.resolve(ret);
        }
    }

    // ---- saved games ---------------------------------------------------------------------------------------------

    /** Opens a snapshot (created when missing) and hands it to `then`, resolving conflicts with the most recent copy. */
    private interface SnapshotUser {
        void use(SnapshotsClient client, Snapshot snapshot);
    }

    private void openSnapshot(PluginCall call, Activity a, String name, SnapshotUser then) {
        try {
            SnapshotsClient client = PlayGames.getSnapshotsClient(a);
            Task<SnapshotsClient.DataOrConflict<Snapshot>> t =
                client.open(name, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED);
            t.addOnCompleteListener(task -> onOpened(call, client, task, then, 0));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    private void onOpened(PluginCall call, SnapshotsClient client, Task<SnapshotsClient.DataOrConflict<Snapshot>> task, SnapshotUser then, int round) {
        if (!task.isSuccessful()) {
            fail(call, task.getException());
            return;
        }
        SnapshotsClient.DataOrConflict<Snapshot> r = task.getResult();
        if (r == null) {
            call.reject("Saved game could not be opened", "UNKNOWN");
            return;
        }
        if (!r.isConflict()) {
            Snapshot s = r.getData();
            if (s == null) {
                call.reject("Saved game could not be opened", "UNKNOWN");
                return;
            }
            then.use(client, s);
            return;
        }
        // The open() policy normally resolves conflicts; if one still comes back, keep the most recently modified copy.
        if (round >= MAX_CONFLICT_ROUNDS) {
            call.reject("Saved game conflict could not be resolved", "CONFLICT");
            return;
        }
        try {
            SnapshotsClient.SnapshotConflict c = r.getConflict();
            Snapshot mine = c.getSnapshot();
            Snapshot theirs = c.getConflictingSnapshot();
            Snapshot newest = mine.getMetadata().getLastModifiedTimestamp() >= theirs.getMetadata().getLastModifiedTimestamp() ? mine : theirs;
            client.resolveConflict(c.getConflictId(), newest)
                .addOnCompleteListener(next -> onOpened(call, client, next, then, round + 1));
        } catch (Exception e) {
            call.reject("Saved game conflict could not be resolved", "CONFLICT", e);
        }
    }

    @PluginMethod
    public void saveGame(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        String description = call.getString("description", "");
        if (name == null || name.isEmpty() || data == null) {
            call.reject("name and data are required", "UNKNOWN");
            return;
        }
        Activity a = ready(call);
        if (a == null) return;
        openSnapshot(call, a, name, (client, snapshot) -> {
            try {
                snapshot.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));
                SnapshotMetadataChange change = new SnapshotMetadataChange.Builder()
                    .setDescription(description == null ? "" : description)
                    .build();
                client.commitAndClose(snapshot, change).addOnCompleteListener(ct -> {
                    if (!ct.isSuccessful()) {
                        fail(call, ct.getException());
                        return;
                    }
                    JSObject ret = new JSObject();
                    ret.put("available", true);
                    ret.put("saved", true);
                    call.resolve(ret);
                });
            } catch (Exception e) {
                fail(call, e);
            }
        });
    }

    @PluginMethod
    public void loadGame(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.isEmpty()) {
            call.reject("name is required", "UNKNOWN");
            return;
        }
        Activity a = ready(call);
        if (a == null) return;
        openSnapshot(call, a, name, (client, snapshot) -> {
            String text = null;
            try {
                byte[] bytes = snapshot.getSnapshotContents().readFully();
                if (bytes != null && bytes.length > 0) text = new String(bytes, StandardCharsets.UTF_8);
            } catch (Exception e) {
                client.discardAndClose(snapshot);
                fail(call, e);
                return;
            }
            client.discardAndClose(snapshot);
            JSObject ret = new JSObject();
            ret.put("available", true);
            ret.put("data", text);   // null = no cloud save yet
            call.resolve(ret);
        });
    }
}
