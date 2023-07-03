import React, { ReactNode, ChangeEvent, FC, useEffect, useState } from "react";
import { getMint, Mint } from "@solana/spl-token";
import { useApp } from "../AppContext";
import { NativeSelect } from "@mui/material";

export interface SelectedToken {
    name: string,
    mint: Mint,
}

interface TokenSelectProps {
    onTokenSelected: (token: SelectedToken|null) => void;
}

export const TokenSelect: FC<TokenSelectProps> = (props) => {
    const {connection, supportedTokens, showErrorMessage} = useApp();
    const [tokens, setTokens] = useState<ReactNode[]>([]);
    const [tokenName, setTokenName] = useState<string|undefined>(undefined);

    useEffect(() => {
        let tokens = [];
        for (let [label, ] of supportedTokens) {
            tokens.push(<option key={label}>{label}</option>);
        }

        setTokens(tokens);
        setTokenName(tokens.length && tokens[0].key ? tokens[0].key.toString() : '');
    }, [supportedTokens]);

    useEffect(()=> {
        const impl = async() => {
            if (!tokenName) {
                props.onTokenSelected(null);
                return;
            }

            let token = supportedTokens.get(tokenName);
            if (!token) {
                props.onTokenSelected(null);
                return;
            }

            try {
                let mint = await getMint(connection, token.pubkey);
                props.onTokenSelected({
                    name:tokenName,
                    mint: mint
                });
            } catch (e: any) {
                showErrorMessage(e.toString(), true);
                props.onTokenSelected(null);
            }
        }

        impl().then(()=>{});
    }, [tokenName]);

    const onTokenChange = (event: ChangeEvent<HTMLSelectElement>) => {
        setTokenName(event.target.value);
    }

    return (
            <NativeSelect
                value={tokenName}
                className={'select'}
                onChange={onTokenChange}
            >
                {tokens}
            </NativeSelect>
    )
}