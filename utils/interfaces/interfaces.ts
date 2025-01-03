
export interface IUserSlice {
    isLoggedIn: boolean;
    user: {
        _id: string;
        name: string;
        email: string;
        bio: string;
        dp: string | null;
        connections: {
            _id: string;
            name: string;
            email: string;
            chatId: string;
            dp: string | null;
        }[];
    } | null;
}

export interface IChatMessage {
    _id: string;
    senderId: string;
    message: string;
    sentAt: Date;
    isRead: boolean;
    status?: "sending" | "sent";
}

export interface ILastMessage {
    chatId: string;
    lastMessage: IChatMessage;
}

export interface IProfileInfo {
    _id: string;
    name: string;
    email: string;
    bio: string;
    dp: string | null;
    connections: {
        _id: string;
        name: string;
        email: string;
        chatId: string;
        dp: string | null;
    }[];
    createdAt: Date;
}

export interface IToast {
    id: string;
    message: string;
    success: boolean;
}
