import React, {ChangeEvent, FC, useState} from "react";

interface ValueEditProps {
    name: string,
    onChange?: (value: string|undefined) => void;
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

    let [inputStyle, setInputStyle] = useState(initialStyle);
    let checkValue = (event: ChangeEvent<HTMLInputElement>) => {
        let eventValue = event.target.value;
        if (attribs.valueChecker) {
            if (attribs.valueChecker(eventValue)) {
                setInputStyle("input");
                if (attribs.onChange)
                    attribs.onChange(eventValue);
            } else {
                setInputStyle("input-failed");
                if (attribs.onChange)
                    attribs.onChange(undefined)
            }
        } else {
            setInputStyle("input");
            if (attribs.onChange)
                attribs.onChange(eventValue);
        }

        setValue(eventValue);
    };

    return (
        <div className="horizontal">
            <label className="label"><b>{attribs.name}</b></label>
            <input
                className={inputStyle}
                onChange={checkValue}
                readOnly={attribs.readonly ? attribs.readonly : false}
                value={value}
            />
        </div>
    );
}

export { ValueEdit, type ValueEditProps };