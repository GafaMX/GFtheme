'use strict';

import React from 'react';
import Moment from "moment";
import {formatMoney} from "../utils/FormatUtils";

class PurchaseItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={'purchase-item-container col-md-4'}>
                <div className={'purchase-item mb-4 card shadow-sm'}>
                    <div className={'card-header'}>
                        <h4 className={'pourchase-item-name'}>{this.props.purchase.items[0].item_name}</h4>
                    </div>
                    <div className={'card-body'}>
                        <h2 className={'purchase-item-price'}> $ {formatMoney(this.props.purchase.total,0)}</h2>
                        <p className={'purchase-item-created'}>{Moment(this.props.purchase.created_at).format('DD-MM-YYYY HH:MM')}</p>
                    </div>
                </div>
            </div>
        )
    }
}

export default PurchaseItem;