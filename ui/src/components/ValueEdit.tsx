import React, {ChangeEvent, FC, useState} from "react";

interface ValueEditAttributes {
    name: string,
    onChange?: (value: string|null) => void;
    valueChecker?: (value: string|null|undefined) => boolean;
    size?: number;
    readonly?: boolean;
    value?: string|null
}

const ValueEdit: FC<ValueEditAttributes> = (attribs: ValueEditAttributes) => {
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
                    attribs.onChange(null)
            }
        } else {
            setInputStyle("input");
            if (attribs.onChange)
                attribs.onChange(eventValue);
        }

        setValue(eventValue);
    };

    return (
        <div className="value-edit">
            <label><b>{attribs.name}</b></label>
            <input
                className={inputStyle}
                onChange={checkValue}
                size={attribs.size ? attribs.size : 43}
                readOnly={attribs.readonly ? attribs.readonly : false}
                value={value}
            />
        </div>
    );
}

export { ValueEdit };