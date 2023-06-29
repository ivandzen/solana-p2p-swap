import React, { ChangeEvent, FC, useEffect, useState } from "react";
import { DatalistInput, Item } from "react-datalist-input";
import { getMint, Mint } from "@solana/spl-token";
import { useApp } from "../AppContext";

interface TokenItemProps {
    label: string,
}

export interface SelectedToken {
    name: string,
    mint: Mint,
}

const TokenItem: FC<TokenItemProps> = (props) => {
    return (
        <div className="token-item">
            <div className="horizontal">
                <label><b>{props.label}</b></label>
            </div>
        </div>
    )
}

interface TokenSelectProps {
    onTokenSelected: (token: SelectedToken|null) => void;
}

export const TokenSelect: FC<TokenSelectProps> = (props) => {
    const {connection, supportedTokens, showErrorMessage} = useApp();
    const [tokens, setTokens] = useState<Item[]>([]);
    const [tokenName, setTokenName] = useState<string|undefined>(undefined);
    const [tokenMint, setTokenMint] = useState<Mint|undefined>(undefined);

    useEffect(() => {
        let tokens = [];
        for (let [label, ] of supportedTokens) {
            tokens.push({
                            id: label,
                            node: <TokenItem label={label} />
                        });
        }

        setTokens(tokens);
        setTokenName(tokens.length ? tokens[0].id : '');
    }, [supportedTokens]);

    useEffect(()=> {
        const impl = async() => {
            if (!tokenName) {
                setTokenMint(undefined);
                props.onTokenSelected(null);
                return;
            }

            let token = supportedTokens.get(tokenName);
            if (!token) {
                setTokenMint(undefined);
                props.onTokenSelected(null);
                return;
            }

            try {
                let mint = await getMint(connection, token.pubkey);
                setTokenMint(mint);
                props.onTokenSelected({
                    name:tokenName,
                    mint: mint
                });
            } catch (e: any) {
                showErrorMessage(e.toString());
                setTokenMint(undefined);
                props.onTokenSelected(null);
            }
        }

        impl().then(()=>{});
    }, [tokenName]);

    return (
        <DatalistInput
            className={"datalist"}
            inputProps={{
                type: "number",
                className: tokenMint ? '' : 'invalid',
                title: tokenMint?.address.toBase58(),
            }}
            label={''}
            showLabel={false}
            isExpandedClassName="token-list"
            value={tokenName}
            items={tokens}
            onSelect={(item: Item) => {setTokenName(item.node.props.label)}}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {setTokenName(event.target.value)}}
        />
    )
}