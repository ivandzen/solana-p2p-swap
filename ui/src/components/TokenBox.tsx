import React, { ChangeEvent, EventHandler, FC, useState } from "react";
import {Mint} from "@solana/spl-token"
import { useApp } from "../AppContext";
import { DatalistInput, Item } from "react-datalist-input";
import { PublicKey } from "@solana/web3.js";
import { publicKeyChecker } from "../p2p-swap";

interface TokenBoxProps {
    name: string,
    mint: Mint|null,
}

interface TokenItemProps {
    value: PublicKey,
    label?: string
}

const TokenItem: FC<TokenItemProps> = (props) => {
    return (
        <div className="token-item">
            <div className="horizontal">
                <label><b>{props.label}</b>{": " + props.value.toBase58()}</label>
            </div>
        </div>
    )
}

const TokenBox: FC<TokenBoxProps> = (props) => {
    const {connection, supportedTokens, wallet} = useApp();
    const [value, setValue] = useState<string|undefined>(undefined);
    const [inputStyle, setInputStyle] = useState<string>('invalid');

    const checkAndSetValue = (value: string) => {
        console.log(`checkAndSetValue: ${value}`);
        let publicKey = supportedTokens.get(value);
        if (publicKey) {
            setInputStyle('');
            setValue(value)
        } else {
            setInputStyle(publicKeyChecker(value) ? '': 'invalid');
            setValue(value);
        }
    }
    const onItemSelected = (item: Item) => {
        checkAndSetValue(item.node.props.label);
    };

    const onChange = (event: any) => {
        checkAndSetValue(event.target.value);
    };

    let tokens = new Array();
    for (let [label, pubkey] of supportedTokens) {
        tokens.push({id: label, node: <TokenItem value={pubkey} label={label}/>});
    }

    return (
        <div className="token-box">
            <label className="label"><b>{props.name}</b></label>
            <DatalistInput
                inputProps={{type: "text", className: inputStyle}}
                label={props.name}
                showLabel={false}
                isExpandedClassName="token-list"
                value={value}
                items={tokens}
                onSelect={onItemSelected}
                onChange={onChange}
            />
        </div>
    )
}

export {
    TokenBox
}