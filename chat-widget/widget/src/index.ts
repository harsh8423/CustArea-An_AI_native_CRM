import { ChatWidget } from "./ui";

type InitConfig = {
    siteId: string;
};

(function () {
    (window as any).MyChatbotWidget = {
        init(config: InitConfig) {
            if (!config.siteId) throw new Error("siteId is required");
            new ChatWidget(config);
        },
    };
})();
