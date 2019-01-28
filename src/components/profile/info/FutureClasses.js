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

    //handleClick de cancelacion llama a api de cancelacion de reserva
    //modal de "Esta seguro de cancelar reserva?"

    render() {

        const listItems = this.state.list.map((reservation) =>
                //console.log(reservation)
            <ClassItem key={reservation.id} reservation={reservation}/>
        );
        return (
            <div>

                <h1 className={"display-4 container text-center"}>{Strings.FUTURESCLASSES}</h1>
                <div className={"reservation-list container"}>
                    <div className={"row mt-5 justify-content-center text-center"}>
                        {listItems}
                    </div>
                </div>
            </div>
        )
    }

}

export default FutureClasses;