import { sendMessage } from "./api";
import { getOrCreateAnonId } from "./storage";

type InitConfig = {
  siteId: string;
};

export class ChatWidget {
  private config: InitConfig;
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private isOpen = false;
  private anonId: string;
  private conversationId: string | null = null;

  constructor(config: InitConfig) {
    this.config = config;
    this.anonId = getOrCreateAnonId();

    this.host = document.createElement("div");
    this.host.id = "my-chatbot-widget-root";
    this.host.style.position = "fixed";
    this.host.style.right = "24px";
    this.host.style.bottom = "24px";
    this.host.style.zIndex = "999999";
    this.host.style.fontFamily =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    document.body.appendChild(this.host);
    this.shadow = this.host.attachShadow({ mode: "open" });
    this.render();
  }

  private render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          --primary: #6366f1;
          --primary-hover: #4f46e5;
          --bg: #ffffff;
          --text: #1f2937;
          --text-light: #6b7280;
          --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }

        * {
          box-sizing: border-box;
        }

        .launcher {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-hover));
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s;
          position: absolute;
          bottom: 0;
          right: 0;
          z-index: 2;
        }

        .launcher:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
        }

        .launcher svg {
          width: 32px;
          height: 32px;
          transition: transform 0.3s;
        }

        .launcher.open svg {
          transform: rotate(90deg);
          opacity: 0;
        }
        
        .launcher .close-icon {
          position: absolute;
          opacity: 0;
          transform: rotate(-90deg);
        }
        
        .launcher.open .close-icon {
          opacity: 1;
          transform: rotate(0);
        }
        
        .launcher.open .chat-icon {
            opacity: 0;
        }

        .window {
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 120px);
          background: var(--bg);
          border-radius: 20px;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: bottom right;
          opacity: 1;
          transform: scale(1);
          border: 1px solid rgba(0,0,0,0.05);
        }

        .hidden {
          opacity: 0;
          transform: scale(0.9) translateY(20px);
          pointer-events: none;
        }

        .header {
          padding: 20px;
          background: linear-gradient(135deg, var(--primary), var(--primary-hover));
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-title {
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.025em;
        }
        
        .header-subtitle {
          font-size: 13px;
          opacity: 0.9;
          font-weight: 400;
        }

        .messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background-color: #f9fafb;
          scroll-behavior: smooth;
        }

        .msg {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 15px;
          line-height: 1.5;
          position: relative;
          word-wrap: break-word;
          animation: fadeIn 0.3s ease-out forwards;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .msg-user {
          align-self: flex-end;
          background: var(--primary);
          color: white;
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
        }

        .msg-assistant {
          align-self: flex-start;
          background: white;
          color: var(--text);
          border-bottom-left-radius: 4px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        
        .msg-system {
            align-self: center;
            font-size: 12px;
            color: var(--text-light);
            background: transparent;
            box-shadow: none;
            padding: 0;
        }

        .input-area {
          padding: 16px;
          background: white;
          border-top: 1px solid #f3f4f6;
        }

        .input-row {
          display: flex;
          gap: 10px;
          position: relative;
        }

        .input {
          flex: 1;
          padding: 14px 16px;
          padding-right: 48px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          outline: none;
          font-size: 15px;
          transition: border-color 0.2s, box-shadow 0.2s;
          background: #f9fafb;
        }

        .input:focus {
          border-color: var(--primary);
          background: white;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .send-btn {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, transform 0.2s;
        }
        
        .send-btn:hover {
            background: var(--primary-hover);
            transform: translateY(-50%) scale(1.05);
        }
        
        .send-btn:disabled {
            background: #e5e7eb;
            cursor: not-allowed;
        }

        .send-btn svg {
          width: 18px;
          height: 18px;
          margin-left: 2px; /* optical adjustment */
        }
        
        /* Scrollbar */
        .messages::-webkit-scrollbar {
            width: 6px;
        }
        .messages::-webkit-scrollbar-track {
            background: transparent;
        }
        .messages::-webkit-scrollbar-thumb {
            background-color: #d1d5db;
            border-radius: 20px;
        }
      </style>

      <div class="window hidden">
        <div class="header">
          <div>
            <div class="header-title">Chat Support</div>
            <div class="header-subtitle">We typically reply in seconds</div>
          </div>
        </div>
        <div class="messages">
            <div class="msg msg-assistant">Hello! How can I help you today? 👋</div>
        </div>
        <div class="input-area">
            <form class="input-row">
              <input type="text" class="input" placeholder="Type a message..." />
              <button type="submit" class="send-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
        </div>
      </div>

      <button class="launcher">
        <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    const launcher = this.shadow.querySelector(".launcher") as HTMLButtonElement;
    const windowEl = this.shadow.querySelector(".window") as HTMLDivElement;
    const form = this.shadow.querySelector(".input-row") as HTMLFormElement;
    const input = this.shadow.querySelector(".input") as HTMLInputElement;
    const messages = this.shadow.querySelector(".messages") as HTMLDivElement;

    launcher.onclick = () => {
      this.isOpen = !this.isOpen;
      windowEl.classList.toggle("hidden", !this.isOpen);
      launcher.classList.toggle("open", this.isOpen);
      if (this.isOpen) setTimeout(() => input.focus(), 100);
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      this.appendMessage(messages, "user", text);
      input.value = "";

      try {
        const resp = await sendMessage(
          this.config.siteId,
          this.anonId,
          text,
          this.conversationId ?? undefined
        );
        this.conversationId = resp.conversationId;
        this.appendMessage(messages, "assistant", resp.reply);
      } catch (err) {
        console.error(err);
        this.appendMessage(messages, "assistant", "Something went wrong. Please try again.");
      }
    };
  }

  private appendMessage(container: HTMLElement, role: "user" | "assistant", text: string) {
    const el = document.createElement("div");
    el.className = `msg msg-${role}`;
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }
}
