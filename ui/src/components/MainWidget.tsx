import React, {FC} from "react";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {BuyTab} from "./BuyTab";
import {SellTab} from "./SellTab";
import {useApp} from "../AppContext";
import { Visibility } from "./Visibility";

function ModeButton(
    { name, onClick, activeName }:
        {
            name: string,
            onClick: (event:any)=>void,
            activeName: string|null,
        }) {
    return (
        <button
            className={name === activeName ? "tabbutton-active" : "tabbutton"}
            onClick={onClick}
        >
            {name}
        </button>
    );
}

function ModeTab(
    {name, activeName, children}:
        {
            name: string,
            activeName: string|null,
            children: any
        }) {
    return (
        <div id={name} className={activeName === name ? "" : "inactive"}>
            {children}
        </div>
    )
}

const MainWidget: FC = () => {
    const {appMode, setAppMode} = useApp();

    const buyClick = () => {
        setAppMode("Buy");
    };

    const sellClick = () => {
        setAppMode("Sell");
    };

    return  (
        <div className="mainwindow">
            <div className="walletbutton">
                <WalletMultiButton/>
            </div>
            <div className ="tab">
                <Visibility isActive={appMode === "Connect-Wallet"}>
                    <div className="tabcontent">
                        <div className="vertical">
                            <h1>Please, connect your Solana wallet</h1>
                        </div>
                    </div>
                </Visibility>
                <Visibility isActive={appMode === "Buy" || appMode === "Sell"}>
                    <div className="tabcontent">
                        <div className="horizontal">
                            <ModeButton name="Buy" onClick={buyClick} activeName={appMode}/>
                            <ModeButton name="Sell" onClick={sellClick} activeName={appMode}/>
                        </div>

                        <ModeTab name="Buy" activeName={appMode}><BuyTab/></ModeTab>
                        <ModeTab name="Sell" activeName={appMode}><SellTab/></ModeTab>
                    </div>
                </Visibility>
                <Visibility isActive={appMode === "Send-Txn"}>
                    <div className="tabcontent">
                        <h1>Sending transaction...</h1>
                    </div>
                </Visibility>
                <Visibility isActive={appMode === "Sign-Pubkey"}>
                    <div className="tabcontent">
                        <div className="vertical">
                            <h1>Signing order public key...</h1>
                            <div className="label-attention">
                                <b>
                                    <p>Message contains order address</p>
                                    <p>encoded in binary form. This signature</p>
                                    <p>later will be used by buyers to unlock</p>
                                    <p>Your order.</p>
                                </b>
                            </div>
                        </div>
                    </div>
                </Visibility>
              </div>
        </div>
    );
}

export {MainWidget}