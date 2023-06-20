import React, {ChangeEvent, FC, useEffect, useState} from "react";
import {Visibility} from "./Visibility";

interface ValueEditProps {
    name: string,
    onChange?: (value: string) => void;
    valueChecker?: (value: string|undefined) => boolean;
    size?: number;
    readonly?: boolean;
    value?: string
}

const ValueEdit: FC<ValueEditProps> = (attribs: ValueEditProps) => {
    let [value, setValue] = useState(attribs.value ? attribs.value : '');
    let initialStyle = 'input';
    if (attribs.readonly)
        initialStyle = 'input-readonly';
    else if (attribs.valueChecker && !attribs.valueChecker(attribs.value))
        initialStyle = 'input-failed';

    const checkAndSetValue = (value: string) => {
        if (attribs.readonly) {
            setInputStyle("input-readonly");
        }
        else if (attribs.valueChecker) {
            if (attribs.valueChecker(value)) {
                setInputStyle("input");
            } else {
                setInputStyle("input-failed");
            }
        } else {
            setInputStyle("input");
        }

        setValue(value);
        if (attribs.onChange)
            attribs.onChange(value);
    }

    let [inputStyle, setInputStyle] = useState(initialStyle);
    let checkValue = (event: ChangeEvent<HTMLInputElement>) => {
        let eventValue = event.target.value;
        checkAndSetValue(eventValue);
    };

    useEffect(() => {
        checkAndSetValue(attribs.value ? attribs.value : "");
    }, [attribs.value]);

    return (
        <div className="horizontal">
            <label className="label"><b>{attribs.name}</b></label>
            <input
                className={inputStyle}
                onChange={checkValue}
                readOnly={attribs.readonly ? attribs.readonly : false}
                value={value}
            />
            <Visibility isActive={attribs.readonly ? attribs.readonly : false} >
                <button
                    className="copy-button"
                    onClick={() => {navigator.clipboard.writeText(value).then(()=>{})}}
                >
                    {'📋'}
                </button>
            </Visibility>
        </div>
    );
}

export { ValueEdit, type ValueEditProps };