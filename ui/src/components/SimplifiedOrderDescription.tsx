import React, {FC} from "react";
import { Visibility } from "./Visibility";
import Decimal from "decimal.js";

export interface SimplifiedOrderDescriptionData {
    orderTokenName: string,
    priceTokenName: string,
    price: Decimal,
    minSellAmount: Decimal,
    remainsToFill: Decimal,
    isPrivate: boolean,
}

export interface SimplifiedOrderDescriptionProps {
    data: SimplifiedOrderDescriptionData|null,
}

export const SimplifiedOrderDescription: FC<SimplifiedOrderDescriptionProps> = (props) => {
    return (

            <div className='simplified-description'>
                <label><h3>{`Selling ${props.data?.remainsToFill} ${props.data?.orderTokenName}`}</h3></label>
                <label><h3>{`1 ${props.data?.orderTokenName} = ${props.data?.price} ${props.data?.priceTokenName}`}</h3></label>
                <label><h3>{`Buy minimum ${props.data?.minSellAmount} ${props.data?.orderTokenName}`}</h3></label>
                <Visibility isActive={!!props.data?.isPrivate}>
                    <label className="label-attention">
                        <p>NOTE: This order is private</p>
                        <p>Unlock key is required</p>
                    </label>
                </Visibility>
            </div>


    )
}