'use strict';

import React from 'react';
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";
import PastClassItem from "./PastClassItem";
import PaginationList from "../utils/PaginationList";

class PastClasses extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
            currentPage: 1,
            perPage: 6,
            lastPage: 0,
            total: 0
        }
    }

    componentDidMount() {
        const currentComponent = this;
        GafaFitSDKWrapper.getUserPastReservationsInBrand({
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

    updatePaginationData(result) {
        this.setState({
            list: result.data,
            currentPage: result.current_page
        })
    }

    render() {
        const listItems = this.state.list.map((pastreservation) =>
            <PastClassItem key={pastreservation.id} reservation={pastreservation} id={pastreservation.id}/>
        );
        return (
            <div>
                <h1 className={'display-4 container text-center'}>{Strings.PASTCLASSES}</h1>
                <div className={'past-reservation-list container'}>
                    <div className={'row mt-5 justify-content-center text-center'}>
                        {listItems}
                    </div>
                </div>

                <PaginationList page={this.state.currentPage} perpage={this.state.perPage}
                                allpages={this.state.lastPage} itemsList={this.state.total}
                                updatePaginationData={this.updatePaginationData.bind(this)}
                                getListData={GafaFitSDKWrapper.getUserPastReservationsInBrand}/>
            </div>

        );
    }
}

export default PastClasses;