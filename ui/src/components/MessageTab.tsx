import React, { FC, useState } from "react";
import { useApp } from "../AppContext";
import { Visibility } from "./Visibility";
import { isBooleanObject } from "util/types";

export const MESSAGE_INFO: string = "info";
export const MESSAGE_ERR: string = "err";

export const MessageTab = () => {
    const {
        message,
        messageType,
        closeMessageByClick,
        showInfoMessage
    } = useApp();

    return (
        <Visibility isActive={message !== null}>
            <div className="tabcontent" onClick={() => {
                if (closeMessageByClick)
                    showInfoMessage(null, true);
            }}>
                <Visibility isActive={messageType === MESSAGE_INFO}>
                    <label className={closeMessageByClick ? 'active-label' : ''}>
                        <h3>{message}</h3>
                    </label>
                </Visibility>
                <Visibility isActive={messageType === MESSAGE_ERR}>
                    <label className={closeMessageByClick ? 'active-label' : ''}>
                        <h3>{message}</h3>
                    </label>
                </Visibility>
            </div>
        </Visibility>
    );
}