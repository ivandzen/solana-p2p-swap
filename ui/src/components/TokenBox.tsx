import React, { ChangeEvent, EventHandler, FC, useEffect, useState } from "react";
import { Mint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useApp } from "../AppContext";
import { DatalistInput, Item } from "react-datalist-input";
import { Connection, PublicKey } from "@solana/web3.js";
import { publicKeyChecker, WalletToken } from "../p2p-swap";
import * as timers from "timers";
import { ValueEdit } from "./ValueEdit";

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
    const {
        supportedTokens,
        walletTokens,
    } = useApp();
    const [tokenName, setTokenName] = useState<string|undefined>(undefined);
    const [tokenAddress, setTokenAddress] = useState<string|undefined>(undefined);
    const [inputStyle, setInputStyle] = useState<string>('invalid');
    const [tokens, setTokens] = useState<Item[]>([]);
    const [selectedToken, setSelectedToken] = useState<WalletToken|undefined>(undefined);

    const checkAndSetToken = (value: string) => {
        let publicKey = supportedTokens.get(value);
        if (publicKey) {
            setSelectedToken(walletTokens.get(value));


            setInputStyle('');
            setTokenName(value);
            setTokenAddress(publicKey.toBase58());
        } else {
            setInputStyle(publicKeyChecker(value) ? '': 'invalid');
            setTokenName(value);
            setTokenAddress(value);
        }
    }
    const onTokenSelected = (item: Item) => {
        checkAndSetToken(item.node.props.label);
    };

    const onTokenChange = (event: any) => {
        checkAndSetToken(event.target.value);
    };

    const onAmountChange = (amount: any) => {
        console.log(`NEW AMOUNT: ${amount}`);
    }

    useEffect(() => {
        let tokens = [];
        for (let [, walletToken] of walletTokens) {
            if (walletToken.label) {
                tokens.push({
                                id: walletToken.label,
                                node: <TokenItem value={walletToken.mint} label={walletToken.label}/>
                            });
            }
        }

        setTokens(tokens);
    }, [walletTokens]);

    return (
        <div className="token-box">
            <ValueEdit
                name={props.name}
                type='number'
                onChange={onAmountChange}
            />
            <DatalistInput
                className={"datalist"}
                inputProps={{
                    type: "number",
                    className: inputStyle,
                    title: tokenAddress,
                }}
                label={''}
                showLabel={false}
                isExpandedClassName="token-list"
                value={tokenName}
                items={tokens}
                onSelect={onTokenSelected}
                onChange={onTokenChange}
            />
            <button
                disabled={!publicKeyChecker(tokenAddress)}
                className="copy-button"
                onClick={() => {
                    if (tokenAddress)
                        navigator.clipboard.writeText(tokenAddress).then(()=>{})
                }}
                title="Copy token address"
            >cp</button>
        </div>
    )
}

export {
    TokenBox
}