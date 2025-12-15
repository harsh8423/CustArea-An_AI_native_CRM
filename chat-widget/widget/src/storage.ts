const KEY = "my_chatbot_anon_id";

export function getOrCreateAnonId(): string {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
        id = crypto.randomUUID();
        window.localStorage.setItem(KEY, id);
    }
    return id;
}
