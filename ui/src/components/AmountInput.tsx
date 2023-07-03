import React, { ChangeEvent, FC, useEffect, useState } from "react";
import Decimal from "decimal.js";
import { amountToDecimal } from "../p2p-swap";

export interface AmountInputProps {
    disabled: boolean,
    decimals: number,
    valueStr: string,
    setValueStr: (value: string)=>void,
    onValueChanged: (value: bigint)=>void,
    maximum?: bigint,
}



export const AmountInput: FC<AmountInputProps> = (props) => {
    const [value, setValue] = useState<bigint>(0n);

    useEffect(() => { props.onValueChanged(value) }, [value]);

    useEffect(() => {
        if (props.disabled) {
            return;
        }

        try {
            let amountDec = new Decimal(props.valueStr).mul(Math.pow(10, props.decimals));
            if (amountDec.decimalPlaces() > 0) {
                amountDec = amountDec.round();
                props.setValueStr(amountDec.div(Math.pow(10, props.decimals)).toString());
            }

            let valueBigint = BigInt(amountDec.toFixed());
            if (valueBigint < 0n) {
                valueBigint = 0n;
                props.setValueStr('0');
            } else if (props.maximum && valueBigint > props.maximum) {
                valueBigint = props.maximum;
                props.setValueStr(amountToDecimal(valueBigint, props.decimals).toString());
            }

            setValue(valueBigint);
        } catch (e: any) {
            setValue(0n);
        }
    }, [props.maximum, props.valueStr])
    const onValueChanged = (event: ChangeEvent<HTMLInputElement>) => {
        props.setValueStr(event.target.value);
    }

    return (
        <input
            type='number'
            disabled={props.disabled}
            className={value > 0n ? '' : 'invalid'}
            value={props.valueStr}
            onChange={onValueChanged}
        />
    );
}