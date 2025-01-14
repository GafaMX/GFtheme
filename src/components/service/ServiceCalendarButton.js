'use strict';

import React from "react";
import GlobalStorage from "../store/GlobalStorage";
import Loading from "../common/Loading";
import { renderToString } from "react-dom/server";
import Calendar from "../calendar/Calendar"; 

class ServiceCalendarButton extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            service: null,
            location: null,
            loaded: false,
            error: null, // Agregado para manejar errores de carga
        };
        this.handleClick = this.handleClick.bind(this);
    }

    componentDidMount() {
        const { location_id } = this.props;

        const locations = GlobalStorage.get("locations");
        let first_location = locations.find((location) => {
            return parseInt(location.id) === parseInt(location_id);
        });

        if (!first_location) {
            first_location = locations[0];
        }

        const brand = first_location.brand;

        this.setState({
            brand: brand,
            location: first_location,
            loaded: true,
        });
    }

    /**
     * Handles button click to open the service calendar
     */
    handleClick(event) {
        event.preventDefault();
        const { services_id } = this.props;
        const { brand, location } = this.state;

        console.log("Click en el botón de calendario con los siguientes datos:");
        console.log("services_id:", services_id);
        console.log("brand:", brand);
        console.log("location:", location);

        // Mostrar el contenedor del calendario
        const calendarContainer = document.querySelector('[data-gf-theme="meetings-calendar"]');
        if (calendarContainer) {
            calendarContainer.innerHTML = ""; // Limpiar el contenedor
            calendarContainer.classList.add("active");

            setTimeout(() => {
                calendarContainer.classList.add("show");
            }, 400);
        }

        // Llamada al SDK para obtener el calendario
        GafaFitSDKWrapper.getCalendarForService(
            brand.slug,
            location.slug,
            services_id,
            (result) => {
                console.log("Calendar loaded successfully:", result);

                // Renderizar el calendario dentro del contenedor
                if (calendarContainer) {
                    calendarContainer.innerHTML = result; // Asegúrate de que el `result` contenga el HTML necesario
                    this.setState({ loaded: true });
                }
            },
            (error) => {
                console.error("Error loading calendar:", error);
                this.setState({ error: "Error loading calendar." });
            }
        );
    }

    render() {
        const { services_id, location_id } = this.props;
        const { loaded, error } = this.state;

        return (
            <div>
          
            </div>
        );
    }
}

export default ServiceCalendarButton;



