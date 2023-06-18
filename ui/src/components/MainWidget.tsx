import React, {FC} from "react";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {BuyTab} from "./BuyTab";
import {SellTab} from "./SellTab";
import {useApp} from "../AppContext";

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
                <div className="tabcontent">
                    <div className="horizontal">
                        <ModeButton name="Buy" onClick={buyClick} activeName={appMode}/>
                        <ModeButton name="Sell" onClick={sellClick} activeName={appMode}/>
                    </div>

                    <ModeTab name="Buy" activeName={appMode}><BuyTab/></ModeTab>
                    <ModeTab name="Sell" activeName={appMode}><SellTab/></ModeTab>
                </div>
            </div>
        </div>
    );
}

export {MainWidget}