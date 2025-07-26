import { Socket } from 'socket.io-client';

/**
 * WebRTCを利用して音声チャットを行うクライアントクラス。
 * 複数のピア（他のユーザー）との接続を管理し、音声の送受信を行います。
 */
export class WebRTCAudioClient {
    // 各リモートピアとのRTCPeerConnectionを格納するMap。キーはリモートピアのソケットID。
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    // 自分のマイクからの音声ストリーム。
    private localStream: MediaStream | null = null;
    // Socket.IOのソケット main.tsと共有している。
    private socket: Socket;
    // 音声解析用のAudioContext
    private audioContext: AudioContext | null = null;
    // ローカルストリームの音量解析
    private localStreamAnalyser: AnalyserNode | null = null;
    private localStreamVolumeData: Uint8Array | null = null;
    // リモートストリームの音量解析
    private remoteStreamAnalysers: Map<string, AnalyserNode> = new Map();
    private remoteStreamVolumeData: Map<string, Uint8Array> = new Map();

    /**
     * コンストラクタ。
     * @param socket Socket.IOのソケットインスタンス。
     */
    constructor(socket: Socket) {
        this.socket = socket;
        // Socket.IOのイベントリスナーを設定し、WebRTCのシグナリングを開始。
        this.setupSocketListeners();
    }

    /**
     * 自分のマイクから音声ストリームを取得し、ローカルストリームとして設定します。
     * ブラウザのマイクアクセス許可が必要です。
     * @param micDeviceId 使用するマイクのデバイスID。
     */
    async startLocalStream(micDeviceId?: string) {
        if (this.localStream) {
            console.log('Local stream already exists.');
            return;
        }
        try {
            console.log('Attempting to get local audio stream...');
            // micDeviceIdがundefinedの場合、デフォルトのマイクを使用。
            const audioConstraints: MediaTrackConstraints = micDeviceId ? { deviceId: { exact: micDeviceId } } : {};
            // ユーザーのマイクにアクセスして音声ストリームを取得。
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            console.log('Local audio stream successfully obtained:', this.localStream);

            // 音声解析の準備
            this.audioContext = new AudioContext();
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            this.localStreamAnalyser = this.audioContext.createAnalyser();
            this.localStreamAnalyser.fftSize = 32;
            source.connect(this.localStreamAnalyser);
            this.localStreamVolumeData = new Uint8Array(this.localStreamAnalyser.frequencyBinCount);


            // 既存のピアコネクションにローカルストリームのトラックを追加。
            this.peerConnections.forEach(pc => {
                this.localStream!.getTracks().forEach(track => {
                    pc.addTrack(track, this.localStream!);
                });
            });
        } catch (error) {
            console.error('Error accessing microphone or starting local stream:', error);
            // マイクアクセスが拒否された場合、ユーザーにアラートを表示。
            alert('マイクへのアクセスが拒否されました。ブラウザの設定でマイクの使用を許可してください。');
        }
    }

    /**
     * ローカルストリームの音量を取得します。
     * @returns 0から1の範囲の音量レベル。
     */
    public getLocalStreamVolume(): number {
        if (this.localStreamAnalyser && this.localStreamVolumeData) {
            this.localStreamAnalyser.getByteFrequencyData(this.localStreamVolumeData);
            const sum = this.localStreamVolumeData.reduce((a, b) => a + b, 0);
            return sum / this.localStreamVolumeData.length / 255;
        }
        return 0;
    }

    /**
     * リモートストリームの音量を取得します。
     * @param remoteSocketId 取得するリモートピアのソケットID。
     * @returns 0から1の範囲の音量レベル。
     */
    public getRemoteStreamVolume(remoteSocketId: string): number {
        const analyser = this.remoteStreamAnalysers.get(remoteSocketId);
        const volumeData = this.remoteStreamVolumeData.get(remoteSocketId);
        if (analyser && volumeData) {
            analyser.getByteFrequencyData(volumeData);
            const sum = volumeData.reduce((a, b) => a + b, 0);
            return sum / volumeData.length / 255;
        }
        return 0;
    }

    /**
     * リモートplayer毎に存在するRTCPeerConnectionを作成。
     * @param remoteSocketId 接続するリモートピアのソケットID。
     * @returns 作成されたRTCPeerConnectionインスタンス。
     */
    private createPeerConnection(remoteSocketId: string): RTCPeerConnection {
        // RTCPeerConnectionを初期化。STUNサーバーを設定し、NAT越えを可能にする。
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }, // GoogleのパブリックSTUNサーバー
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        });

        // ICE候補（ネットワーク接続情報）が生成されたときのイベントハンドラ。
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // 生成されたICE候補をSocket.IO経由で相手に送信。
                this.socket.emit('webrtc-candidate', {
                    candidate: event.candidate,
                    targetSocketId: remoteSocketId,
                });
            }
        };

        // リモートピアからメディアトラック（音声など）が追加されたときのイベントハンドラ。
        pc.ontrack = (event) => {
            console.log('Remote track received:', event.track);
            if (event.streams && event.streams[0]) {
                const stream = event.streams[0];
                // 受信した音声ストリームを再生するためのAudio要素を作成。
                const audio = new Audio();
                audio.srcObject = stream; // ストリームをAudio要素のソースに設定。
                audio.play().catch(e => console.error("Error playing audio:", e)); // 音声を再生。
                // TODO: THREE.PositionalAudio対応

                // 音声解析の準備
                if (this.audioContext) {
                    const source = this.audioContext.createMediaStreamSource(stream);
                    const analyser = this.audioContext.createAnalyser();
                    analyser.fftSize = 32;
                    source.connect(analyser);
                    this.remoteStreamAnalysers.set(remoteSocketId, analyser);
                    this.remoteStreamVolumeData.set(remoteSocketId, new Uint8Array(analyser.frequencyBinCount));
                }
            }
        };

        // ここにローカルストリームのトラックを追加
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
            });
        }

        // 作成したピアコネクションをMapに保存。
        this.peerConnections.set(remoteSocketId, pc);
        return pc;
    }

    /**
     * Socket.IOのイベントリスナーを設定し、WebRTCのシグナリングプロセスを処理します。
     */
    private setupSocketListeners() {
        // 新しいプレイヤーが接続したときのイベントハンドラ。
        this.socket.on('webrtc-playerconnected', async (newSocketId: string) => {
            // server/src/index.tsでの接続イベントと同様に、接続されたプレイヤーのIDをログに出力。
            console.log('New player connected, setting up WebRTC:', newSocketId);
            // 新しいピアコネクションを作成。
            const pc = this.createPeerConnection(newSocketId);
            // Offer（接続要求）を作成。
            const offer = await pc.createOffer();
            // 作成したOfferをローカルのDescriptionとして設定。
            await pc.setLocalDescription(offer);
            // OfferをSocket.IO経由で新しいプレイヤーに送信。
            this.socket.emit('webrtc-offer', {
                offer: offer,
                targetSocketId: newSocketId,
            });
        });

        // WebRTC Offerを受信したときのイベントハンドラ。
        this.socket.on('webrtc-offer', async (data: { offer: RTCSessionDescriptionInit, senderSocketId: string }) => {
            console.log('Received WebRTC offer from:', data.senderSocketId);
            // 既存のピアコネクションを取得、なければ新しく作成。
            let pc = this.peerConnections.get(data.senderSocketId);
            if (!pc) {
                pc = this.createPeerConnection(data.senderSocketId);
            }
            // 受信したOfferをリモートのDescriptionとして設定。
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            // Answer（接続応答）を作成。
            const answer = await pc.createAnswer();
            // 作成したAnswerをローカルのDescriptionとして設定。
            await pc.setLocalDescription(answer);
            // AnswerをSocket.IO経由でOfferの送信元に送信。
            this.socket.emit('webrtc-answer', {
                answer: answer,
                targetSocketId: data.senderSocketId,
            });
        });

        // WebRTC Answerを受信したときのイベントハンドラ。
        this.socket.on('webrtc-answer', async (data: { answer: RTCSessionDescriptionInit, senderSocketId: string }) => {
            console.log('Received WebRTC answer from:', data.senderSocketId);
            const pc = this.peerConnections.get(data.senderSocketId);
            // リモートのDescriptionがまだ設定されていない場合のみ設定。
            if (pc && pc.remoteDescription === null) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        });

        // WebRTC ICE Candidateを受信したときのイベントハンドラ。
        this.socket.on('webrtc-candidate', async (data: { candidate: RTCIceCandidateInit, senderSocketId: string }) => {
            console.log('Received WebRTC ICE candidate from:', data.senderSocketId);
            const pc = this.peerConnections.get(data.senderSocketId);
            if (pc) {
                try {
                    // 受信したICE候補をピアコネクションに追加。
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.error('Error adding received ICE candidate', e);
                }
            }
        });

        // プレイヤーが切断したときのイベントハンドラ。
        this.socket.on('playerdisconnected', (disconnectedSocketId: string) => {
            console.log('Player disconnected, closing WebRTC connection:', disconnectedSocketId);
            const pc = this.peerConnections.get(disconnectedSocketId);
            if (pc) {
                pc.close(); // ピアコネクションを閉じる。
                this.peerConnections.delete(disconnectedSocketId); // Mapから削除。
            }
            this.remoteStreamAnalysers.delete(disconnectedSocketId);
            this.remoteStreamVolumeData.delete(disconnectedSocketId);
        });
    }

    /**
     * すべてのWebRTC接続を閉じ、ローカルストリームを停止します。
     * アプリケーション終了時などに呼び出されます。
     */
    closeAllConnections() {
        this.peerConnections.forEach(pc => pc.close()); // すべてのピアコネクションを閉じる。
        this.peerConnections.clear(); // Mapをクリア。
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop()); // ローカルストリームのトラックを停止。
            this.localStream = null; // ローカルストリームをnullに設定。
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
