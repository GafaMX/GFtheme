'use strict';

import React from 'react';
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";
import PurchaseItem from "./PurchaseItem";

class PurchasesList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
            currentPage: 1,
            perPage: 5,
            lastPage: '',
            total: '',
        }
    }

    componentDidMount() {
        const currentComponent = this;
        GafaFitSDKWrapper.getUserPurchasesInBrand({
            page: currentComponent.state.currentPage,
            per_page: currentComponent.state.perPage,
        }, function (result) {
            currentComponent.setState({
                list: result.data,
                currentPage: result.current_page,
                lastPage: result.last_page,
                perPage: result.per_page,
                total: result.total
            })

        })
    }

    updateList(list) {
        this.setState({
            list: list
        })
    }

    // todo falta paginacion
    render(){

        const listItems = this.state.list.map((purchase)=>
        // console.log(purchase)
            <PurchaseItem key={purchase.id} purchase={purchase} id={purchase.id}/>
        );
        return(

            <div>
               <h1 className={'display-4 container text-center'}>{Strings.PURCHASES}</h1>
                <div className={'purchases-list container'}>
                    <div className={'row mt-5 justify-content-center text-center'}>
                        {listItems}
                    </div>
                </div>
            </div>
        )
    }
}

export default PurchasesList;