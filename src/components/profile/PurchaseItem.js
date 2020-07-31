'use strict';

import React from 'react';
import Moment from 'react-moment';
import {formatMoney} from "../utils/FormatUtils";

class PurchaseItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={'purchase-item'}>
                <div className={'card-header'}>
                    <h4 className={'purchase-item-name'}><strong>{this.props.purchase.items[0].item_name}</strong></h4>
                    <h2 className={'purchase-item-price'}> $ {formatMoney(this.props.purchase.total,0)}</h2>
                </div>
                <hr></hr>
                <div className={'card-body'}>
                    <Moment calendar locale="es">{this.props.purchase.created_at}</Moment>
                </div>
            </div>
        )
    }
}

export default PurchaseItem;