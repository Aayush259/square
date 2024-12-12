import { Server as HTTPServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { NextApiRequest } from "next";
import { Socket as NetSocket } from "net";
import jwt from "jsonwebtoken";
import cloudinary from "cloudinary";
import { Readable } from "stream";
import mongoose from "mongoose";
import User from "@/utils/models/User";
import connectMongoDb from "@/utils/lib/mongodb";
import createMessageModel from "@/utils/models/Chat";

const cloudName = process.env.CLOUD_NAME;
const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;

cloudinary.v2.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
});

interface CustomSocket extends Socket {
    data: {
        user: {
            _id: string;
            email: string;
            name: string;
            dp: string | null;
            connections: {
                chatId: string;
                _id: string;
                name: string;
                dp: string | null;
            }[];
        };
    };
}

let io: IOServer;

interface ExtendedNextApiResponse extends NetSocket {
    socket: {
        server: HTTPServer & {
            io?: IOServer;
        }
    }
}

export default async function handler(_: NextApiRequest, res: ExtendedNextApiResponse) {

    if (!res.socket.server.io) {
        console.log("Initializing Socket.io");

        // Creating new Socket.IO server.
        io = new IOServer(res.socket.server, {
            path: "/api/socket/connect",
        });

        // Middleware for jet authentication.
        io.use(async (socket, next) => {
            const token = socket.handshake.auth.token;
            console.log(token)

            if (!token) {
                return next(new Error("Unauthorized"));
            }

            try {
                await connectMongoDb();
                const decodedToken = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
                const user = await User.findById(decodedToken.id);

                if (!user) {
                    console.log("User not found");
                    return next(new Error("User not found"));
                }

                // Attach user information to the socket.
                socket.data.user = {
                    _id: user._id,
                    email: user.email,
                    name: user.name,
                    dp: user.dp,
                    connections: user.connections,
                };

                next();
            } catch (error) {
                console.log("JWT authentication error", error);
                return next(new Error("JWT authentication error"));
            }
        });


        io.on("connection", (socket: CustomSocket) => {
            console.log(socket.data);
            console.log("User connected:", socket.data.user.name);

            // Notify the connected user's connections  that they are active.
            socket.data.user.connections.forEach(async (connection) => {
                const receiverSocket = Array.from(io.sockets.sockets.values()).find((s) => (s as CustomSocket).data.user._id.toString() === connection._id.toString());

                if (receiverSocket) {
                    (receiverSocket as CustomSocket).emit("userActive", {
                        userId: socket.data.user._id,
                    })
                }
            });

            // Gather active connections for the connected user.
            const activeConnections = socket.data.user.connections.filter(
                (connection) => Array.from(io.sockets.sockets.values()).some(
                    (s) => (s as CustomSocket).data.user._id.toString() === connection._id.toString()
                )
            ).map((connection) => connection._id.toString());

            // Send the active connections to the connected user.
            socket.emit("activeConnections", { activeUserIds: activeConnections });

            socket.on("setProfilePicture", async ({ file }: { file: Buffer }, callback) => {
                try {
                    // Validate the file.
                    if (!file) {
                        return callback({ success: false, message: "No file provided" });
                    }

                    await connectMongoDb();

                    const user = await User.findById(socket.data.user._id);

                    if (!user) {
                        return callback({ success: false, message: "User not found" });
                    }

                    // Convert the file buffer to a Readable stream.
                    const stream = Readable.from(file);

                    // Upload image to cloudinary.
                    const uploadStream = cloudinary.v2.uploader.upload_stream(
                        { folder: "Square" },
                        async (error, result) => {
                            if (error) {
                                console.log("Cloudinary upload error:", error);
                                return callback({ success: false, message: "Cloudinary upload error" });
                            }

                            // Update user's profile picture in the database.
                            user.dp = result?.secure_url || null;
                            await user.save();

                            // Update user data in socket.
                            socket.data.user.dp = user.dp;

                            // Notify the user.
                            callback({ success: true, message: "Profile picture updated successfully", dp: user.dp });

                            // Update the user's profile picture in all receiver's connections.
                            for (const connection of user.connections) {
                                // Get the receiver.
                                const receiver = await User.findById(connection._id);

                                if (receiver) {
                                    // Update the profile picture in the receiver's connections array.
                                    const connectionToUpdate = receiver.connections.find(
                                        conn => conn._id.toString() === socket.data.user._id.toString()
                                    );

                                    if (connectionToUpdate) {
                                        connectionToUpdate.dp = user.dp;
                                        await receiver.save();
                                    };

                                    // Notify the receiver in real time.
                                    const receiverSocket = Array.from(io.sockets.sockets.values()).find(
                                        (s) => (s as CustomSocket).data?.user._id.toString() === (receiver._id as string).toString()
                                    );

                                    if (receiverSocket) {
                                        (receiverSocket as CustomSocket).emit("profilePictureUpdated", {
                                            userId: user._id,
                                            dp: user.dp
                                        });
                                    }
                                }
                            }
                        }
                    );

                    // Pipe the file stream to cloudinary.
                    stream.pipe(uploadStream);
                } catch (error) {
                    console.log("Error setting profile picture:", error);
                    callback({ success: false, message: "Internal server error" });
                }
            });

            socket.on("sendMessage", async ({ senderId, receiverId, message }: { senderId: string, receiverId: string, message: string }, callback) => {
                try {
                    await connectMongoDb();

                    // Fetching sender and receiver from the database.
                    const sender = await User.findById(senderId);
                    const receiver = await User.findById(receiverId);

                    // Checking if sender and receiver exist.
                    if (!sender || !receiver) {
                        console.log("Sender or receiver not found");
                        return socket.emit("error", { message: "Sender or receiver not found" });
                    }

                    // Generating a unique chat ID (sorted IDs ensure consistency).
                    const chatId = senderId < receiverId ? `${senderId}_${receiverId}` : `${receiverId}_${senderId}`;

                    // Check if the sender is in the receiver's connections.
                    const isSenderInReceiverConnections = receiver.connections.some(connection => connection._id.toString() === senderId);

                    if (!isSenderInReceiverConnections) {
                        // Add sender to receiver's connections.
                        receiver.connections.push({
                            chatId: chatId,
                            _id: sender._id as mongoose.Types.ObjectId,
                            name: sender.name,
                            dp: sender.dp,
                        });

                        await receiver.save();

                        // Emit a real-time update to the receiver.
                        const receiverSocket = Array.from(io.sockets.sockets.values()).find((s) => (s as CustomSocket).data?.user._id.toString() === receiverId);

                        if (receiverSocket) {
                            (receiverSocket as CustomSocket).emit("connectionUpdated", {
                                chatId: chatId,
                                _id: sender._id,
                                name: sender.name,
                                dp: sender.dp,
                            });
                        }
                    }

                    // Creating or getting message model dynamically.
                    const MessageModel = createMessageModel(chatId);

                    // Saving the message to the database.
                    const newMessage = await MessageModel.create({
                        senderId,
                        message,
                    });

                    // Emit the new message ID and sent the timestamp to the sender.
                    callback({
                        success: true,
                        _id: newMessage._id,
                        sentAt: newMessage.sentAt,
                    })

                    // Emitting message only to receiver.
                    const receiverSocket = Array.from(io.sockets.sockets.values()).find(
                        (s) => {
                            const userId = (s as CustomSocket).data?.user._id.toString();
                            return userId === receiverId;
                        }
                    );

                    if (receiverSocket) {
                        (receiverSocket as CustomSocket).emit("receiveMessage", {
                            _id: newMessage._id,
                            senderId,
                            message,
                            sentAt: newMessage.sentAt,
                            isRead: false,
                        });
                    }

                } catch (error) {
                    console.log("Error sending message:", error);
                    callback({ success: false, message: "Internal server error" });
                }
            });

            socket.on("markAsRead", async ({ chatId, messageIds }: { chatId: string, messageIds: string[] }) => {

                if (!chatId || !messageIds || messageIds.length === 0) {
                    console.log("Invalid chatId or messageIds");
                    return;
                }

                try {
                    await connectMongoDb();

                    const validMessageIds = messageIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

                    if (validMessageIds.length === 0) {
                        console.log("No valid message IDs provided");
                        return;
                    }

                    const MessageModel = createMessageModel(chatId);

                    // Update the message in the database.
                    await MessageModel.updateMany(
                        {
                            _id: { $in: messageIds },   // Match messages by their IDs.
                            senderId: { $ne: socket.data.user._id },    // Exclude messages sent by the current user.
                        },   // Match messages by their IDs.
                        { isRead: true }      // Set isRead to true.
                    );

                    const [id1, id2] = chatId.split("_");

                    const senderId = id1 === socket.data.user._id.toString() ? id2 : id1;

                    // Notify sender about read status.
                    const senderSocket = Array.from(io.sockets.sockets.values()).find(
                        (s) => (s as CustomSocket).data?.user._id.toString() === senderId
                    );

                    if (senderSocket) {
                        // Emitting update to sender.
                        (senderSocket as CustomSocket).emit("messageRead", {
                            chatId,
                            messageIds,
                        });
                    }
                } catch (error) {
                    console.log("Error marking message as read:", error);
                }
            })

            socket.on("disconnect", () => {
                console.log("User disconnected:", socket.id);

                // Notify connections that the user is inactive.
                socket.data.user.connections.forEach(async (connection) => {
                    const receiverSocket = Array.from(io.sockets.sockets.values()).find(
                        (s) => (s as CustomSocket).data?.user._id.toString() === connection._id.toString()
                    );

                    if (receiverSocket) {
                        (receiverSocket as CustomSocket).emit("userInactive", {
                            userId: socket.data.user._id,
                        });
                    }
                });
            })
        })

        res.socket.server.io = io;
    }

    res.end();
}
