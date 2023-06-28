import React, {FC} from "react";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {BuyTab} from "./BuyTab";
import {SellTab} from "./SellTab";
import {useApp} from "../AppContext";
import { Visibility } from "./Visibility";
import {OrderList} from "./OrderList";
import { AirdropPage } from "./AirdropPage";

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
    const {appMode, setAppMode, errorMessage, showErrorMessage, updateWalletTokens} = useApp();

    return  (
        <div>
            <div className="mainwindow">
                <div className="walletbutton">
                    <WalletMultiButton/>
                </div>
                <div className ="tab">
                    <Visibility isActive={!errorMessage && (appMode === "Connect-Wallet")}>
                        <div className="tabcontent">
                            <div className="vertical">
                                <h1>{"Please, connect your Solana wallet ⇧"}</h1>
                            </div>
                        </div>
                    </Visibility>
                    <Visibility isActive={!errorMessage && appMode === "Order-List"}>
                        <OrderList></OrderList>
                    </Visibility>
                    <Visibility isActive={!errorMessage && (appMode === "Buy" || appMode === "Sell" || appMode === "Airdrop")}>
                        <div className="tabcontent">
                            <div className="horizontal">
                                <ModeButton name="Buy" onClick={() => {
                                    setAppMode("Buy");
                                    updateWalletTokens();
                                }} activeName={appMode}/>
                                <ModeButton name="Sell" onClick={() => {
                                    setAppMode("Sell");
                                    updateWalletTokens();
                                }} activeName={appMode}/>
                                <ModeButton name="Airdrop" onClick={() => {
                                    setAppMode("Airdrop");
                                    updateWalletTokens();
                                }} activeName={appMode}/>
                            </div>

                            <ModeTab name="Buy" activeName={appMode}><BuyTab/></ModeTab>
                            <ModeTab name="Sell" activeName={appMode}><SellTab/></ModeTab>
                            <ModeTab name="Airdrop" activeName={appMode}><AirdropPage/></ModeTab>
                        </div>
                    </Visibility>
                    <Visibility isActive={!errorMessage && appMode === "Send-Txn"}>
                        <div className="tabcontent">
                            <h1>Sending transaction...</h1>
                        </div>
                    </Visibility>
                    <Visibility isActive={!errorMessage && appMode === "Sign-Pubkey"}>
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
                    <div
                        className={errorMessage ? 'error-message' : 'error-message-inactive'}
                        onClick={() => { showErrorMessage(null) }}
                    >
                        {errorMessage}
                    </div>
                </div>
            </div>
        </div>
    );
}

export {MainWidget}