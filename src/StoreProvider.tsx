"use client";
import store from "@/src/store/store";
import { Provider } from "react-redux";

const StoreProvider: React.FC<{
    children: React.ReactNode
}> = ({
    children
}) => {
        return (
            <Provider store={store}>
                {children}
            </Provider>
        );
    };

export default StoreProvider;
