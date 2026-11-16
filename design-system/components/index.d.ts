export interface ButtonProps { variant?: 'primary' | 'secondary' | 'danger'; fullWidth?: boolean; disabled?: boolean; onClick?: () => void; children?: any }
export interface RewardButtonProps { benefit: string; disabled?: boolean; onClick?: () => void }
export interface CounterProps { kind?: 'lives' | 'coins' | 'score' | 'level'; value: number | string; label?: string }
export interface HudProps { lives: number | string; level: number | string; score: number | string; coins: number | string }
export interface GemProps { kind: 'lava' | 'amber' | 'jade' | 'ice' | 'geode' | 'bone'; size?: number }
export interface BlockProps { tier?: 1 | 2 | 3 | 4 | 5; width?: number; height?: number; damage?: number }
export interface AdOverlayProps { kind?: 'interstitial' | 'rewarded'; secondsLeft?: number; onClose?: () => void; children?: any }
export interface ResultScreenProps { outcome?: 'win' | 'lose'; stars?: number; score: number | string; detail?: string; offer?: string; onOffer?: () => void; onNext?: () => void; onRetry?: () => void }
export interface HistoryPlayerProps { era: string; caption: string; progress?: number; onSkip?: () => void; children?: any }
export interface ConsentSheetProps { onAccept?: () => void; onManage?: () => void; children?: any }
export interface ModalProps { title: string; actions?: any; inline?: boolean; children?: any }
export interface ToastProps { message: string; tone?: 'info' | 'success' | 'error' }
