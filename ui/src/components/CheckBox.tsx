import {FC} from "react";
import React from "react";

interface CheckBoxProps {
    name: string,
}

const CheckBox: FC<CheckBoxProps> = (props) => {
    let onClick = (cb: any) => {
        console.log(cb);
    }

    return (
        <div className="horizontal">
            <input className="checkbox" type="checkbox" onChange={onClick}/>
            <label className="label"><b>{props.name}</b></label>
        </div>
    )
}

export {type CheckBoxProps, CheckBox}