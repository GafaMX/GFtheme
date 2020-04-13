// 'use strict';

import React from "react";
import GlobalStorage from "../store/GlobalStorage";
import {FormGroup} from "react-bootstrap";

export default class LocationsFilter extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            locations : []
        };

        // this.loadSources = this.loadSources.bind(this);
        GlobalStorage.addSegmentedListener(['locations'], this.updateLocations.bind(this));
    }

    updateLocations(){
        let locations = GlobalStorage.get('locations');

        this.setState({
            locations: locations
        })
    }

    render(){
        let preE = 'GFSDK-e';
        let preC = 'GFSDK-c';
        let formClass = preE + '-form';

        let {locations} = GlobalStorage.get('locations');

        
        let locationsOptions = locations.forEach(location => {

            if(location != undefined){
                console.log(location);
            }
            // <option value={location.slug}> {location.name}</option>
            }
        );

        console.log(locationsOptions);
        
        return(
            <div>
                <h3>Filtro de ubicaciones</h3>
                <select>
                    <option value={undefined}>Selecciona una opción</option>
                    {locationsOptions}
                </select>
            </div>
        )
    }
}
