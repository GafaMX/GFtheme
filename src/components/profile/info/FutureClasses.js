'use strict';

import React from 'react';
import ClassItem from "./ClassItem";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import Strings from "../../utils/Strings/Strings_ES";

class FutureClasses extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
            counterBuyItems: ''
        }

    }

    componentDidMount() {
        const currentComponent = this;
        GafaFitSDKWrapper.getUserFutureReservationsInBrand({
            reducePopulation: true,
        }, function (result) {
            currentComponent.setState({
                list: result,
            })
        })
    }

    updateList(list) {
        this.setState({
            list: list
        });
    }

    render() {

        const listItems = this.state.list.map((reservation) =>
            <ClassItem key={reservation.id} reservation={reservation} id={reservation.id}/>
        );
        return (
            <div>
                <h2 className={"display-4 container text-center"}>{Strings.FUTURESCLASSES}</h2>
                <div className={"reservation-list container"}>
                    <div className={"row mt-5 justify-content-center text-center"}>
                        <p></p>
                        {listItems}
                    </div>
                </div>
            </div>
        )
    }

}

export default FutureClasses;