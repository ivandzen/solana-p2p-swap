import React from 'react';
import {FC} from 'react';

interface TabProps {
    isActive: boolean,
    children: any,
}
const Visibility: FC<TabProps> = (props) => {
    return (
        <div className="visibilitytab">
            <div className={props.isActive ? "" : "inactive"}>
                {props.children}
            </div>
        </div>
    )
}

export {type TabProps, Visibility};