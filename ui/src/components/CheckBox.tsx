import {FC} from "react";
import React from "react";

interface CheckBoxProps {
    name: string,
    setChecked: (checked: boolean) => void,
}

const CheckBox: FC<CheckBoxProps> = (props) => {
    let onClick = (cb: any) => {
        props.setChecked(cb.target.checked);
    }

    return (
        <div className="horizontal">
            <input type="checkbox" onChange={onClick}/>
            <label className="label"><b>{props.name}</b></label>
        </div>
    )
}

export {type CheckBoxProps, CheckBox}