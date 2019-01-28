'use strict';

import React from 'react';
import ClassItem from "./ClassItem";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";

class FutureClasses extends React.Component {
    constructor(props) {
        super(props);
        this.state= {
            list: [],
        }

    }

componentDidMount(){
        const currentComponent = this;
        GafaFitSDKWrapper.getUserFutureReservationsInBrand({
            reducePopulation: true,
        }, function(result){
            currentComponent.setState({
                list: result,
            })
        })
}

    updateList(list){
        this.setState({
            list:list
        });
    }
        //handleClick de cancelacion llama a api de cancelacion de reserva
        //modal de "Esta seguro de cancelar reserva?"

    render() {

        //mostrar la lista en cards.
        // location, staff, position, meeting_start
        // (y si esta cancelada "Reserva Cancelada" {cancelled = 1},
        // si no disponible "X" para cancelacion)
        //
            const listItems= this.state.list.map((reservation) =>
                console.log(reservation)
            // <ClassItem key={reservation.id} reservation={reservation}/>
            );
        return(
           <div>clasesFuturas
               {listItems}
            </div>
        )
    }

}

export default FutureClasses;