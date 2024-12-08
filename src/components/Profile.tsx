"use client";
import Image from "next/image";
import { useProfileContext } from "../contexts/ProfileContext";
import { MdOutlineContentCopy } from "react-icons/md";
import { IoClose, IoCameraSharp } from "react-icons/io5";
import { useEffect, useState } from "react";
import { FaRegCircleCheck } from "react-icons/fa6";
import { copyToClipboard, formatDate2 } from "../../utils/funcs/funcs";
import { useSelector } from "react-redux";
import { RootState } from "../store/store";
import { useChatContext } from "../contexts/ChatContext";
import Loader from "./Loader";

const Profile = () => {

    // Getting the state from the ProfileContext.
    const { isProfileOpen, setIsProfileOpen, isLoading, profileInfo } = useProfileContext();
    const { addDp } = useChatContext();     // Function to add the DP to the chat.

    // User state from store.
    const { user } = useSelector((state: RootState) => state.user);

    const [idCopied, setIdCopied] = useState<boolean>(false);   // State to track whether the ID has been copied.

    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined;

        // If idCopied is true, then set it to false after 4 seconds.
        if (idCopied) {
            intervalId = setTimeout(() => {
                setIdCopied(false);
            }, 4000);
        }

        // Clean up the interval on component unmount.
        return () => {
            if (intervalId) {
                clearTimeout(intervalId);
            }
        };
    }, [idCopied]);

    // Function to copy the user's ID to the clipboard.
    const copyIdToClipboard = () => {
        copyToClipboard(profileInfo?._id || "");
        setIdCopied(true);
    };

    return (
        <div className={`py-8 h-full w-full fixed lg:absolute top-0 left-0 duration-300 z-[100] overflow-hidden bg-[#0A0A0A] ${isProfileOpen ? "translate-x-0" : "translate-x-full"}`}>
            <button className="absolute top-4 right-4 lg:hover:opacity-80 duration-300" onClick={() => setIsProfileOpen(false)}>
                <IoClose size={30} className="text-white" />
            </button>
            {
                isLoading ? <Loader /> : <div className="h-full w-full">{
                    profileInfo && (
                        <div className="h-full w-full flex flex-col items-center gap-2 overflow-y-auto">
                            {
                                profileInfo.dp ? (
                                    user?._id === profileInfo._id ? (
                                        <label htmlFor="addDp" className="cursor-pointer h-[100px] w-[100px] flex items-center justify-center lg:hover:opacity-40 duration-200">
                                            <input
                                                type="file"
                                                name="addDp"
                                                id="addDp"
                                                className="hidden"
                                                onChange={addDp}
                                                accept="image/*"
                                            />
                                            <Image
                                                src={profileInfo.dp}
                                                alt={profileInfo.name}
                                                width={100}
                                                height={100}
                                                className="rounded-full h-full w-full object-cover object-top"
                                            />
                                        </label>
                                    ) : (
                                        <span className="block w-[100px] h-[100px] rounded-full overflow-hidden">
                                            <Image
                                                src={profileInfo.dp}
                                                alt={profileInfo.name}
                                                width={100}
                                                height={100}
                                                className="rounded-full w-full h-full object-cover object-top"
                                            />
                                        </span>
                                    )
                                ) : (
                                    <div className={`h-[100px] w-[100px] flex items-center justify-center text-white text-5xl rounded-full overflow-hidden ${user?._id !== profileInfo._id ? "bg-blue-700" : "border-2 border-gray-800"}`}>
                                        {
                                            user?._id === profileInfo._id ? (
                                                <label htmlFor="addDp" className="cursor-pointer h-full w-full flex items-center justify-center lg:hover:opacity-40 duration-200">
                                                    <input
                                                        type="file"
                                                        name="addDp"
                                                        id="addDp"
                                                        className="hidden"
                                                        onChange={addDp}
                                                        accept="image/*"
                                                    />
                                                    <IoCameraSharp size={50} className="opacity-70" />
                                                </label>
                                            ) : profileInfo.name[0]
                                        }
                                    </div>
                                )
                            }

                            <p className="text-2xl">
                                <span className="font-semibold">{profileInfo.name}</span><span className="opacity-70">{user?._id === profileInfo._id && " (You)"}</span>
                            </p>

                            <p className="mb-4 lg:mb-0">{profileInfo.email}</p>

                            {
                                profileInfo._id === user?._id && profileInfo.connections.length > 0 && <div className="w-full px-4 md:px-8 py-4 border-t border-b border-t-gray-800 border-b-gray-800 my-3">

                                    <p className="text-xl mb-2">Your Connections:</p>

                                    <div className="flex items-center gap-5 w-full overflow-x-auto">
                                        {
                                            profileInfo.connections.map(connection => (
                                                <div className="flex items-center justify-center flex-col gap-2" key={connection._id}>
                                                    {connection.dp ? (
                                                        <span className="block w-[50px] h-[50px] rounded-full overflow-hidden">
                                                            <Image
                                                                src={connection.dp}
                                                                alt={connection.name}
                                                                width={50}
                                                                height={50}
                                                                className="rounded-full h-full w-full object-cover object-top"
                                                            />
                                                        </span>
                                                    ) : (
                                                        <div className="h-[50px] w-[50px] flex items-center justify-center bg-blue-700 text-white text-xl rounded-full overflow-hidden">
                                                            {connection.name[0]}
                                                        </div>
                                                    )}

                                                    <p>{connection.name.split(" ")[0]}</p>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            }

                            <div className="w-full flex items-center justify-between gap-4 px-4 md:px-8">
                                {profileInfo._id}
                                <button className="w-fit" onClick={copyIdToClipboard}>
                                    {idCopied ? <FaRegCircleCheck size={20} /> : <MdOutlineContentCopy size={20} className="lg:hover:opacity-80 duration-300" />}
                                </button>
                            </div>

                            <div className="w-full px-4 md:px-8 py-3 border-t border-b border-t-gray-800 border-b-gray-800 my-3">
                                <p>Joined on: {formatDate2(profileInfo.createdAt)}</p>
                            </div>
                        </div>
                    )
                }</div>
            }
        </div>
    );
};

export default Profile;
