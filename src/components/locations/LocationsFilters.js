// 'use strict';

import React from "react";
import GlobalStorage from "../store/GlobalStorage";
import Select from "react-select";

// Estilos
import '../../styles/newlook/components/GFSDK-c-Filter.scss';

export default class LocationsFilter extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            locations : GlobalStorage.get('locations'),
            currentLocation: GlobalStorage.get('currentLocation'),
        };

        GlobalStorage.addSegmentedListener(['currentLocation'], this.updateFilter.bind(this));
    }

    updateFilter(){
        let currentLocation = GlobalStorage.get('currentLocation');

        this.setState({
            currentLocation : currentLocation,
        });
    }

    handleCurrentLocation(e){
        window.GFtheme.brand = e.brand.slug;
        window.GFtheme.location = e.slug;

        localStorage.setItem('__GFthemeBrand', e.brand.slug);
        localStorage.setItem('__GFthemeLocation', e.slug);

        GlobalStorage.set('currentBrand', e.brand);
        GlobalStorage.set('currentLocation', e);
    }

    render(){
        let locations = GlobalStorage.get('locations');
        let currentLocation = GlobalStorage.get('currentLocation');

        return(
            <div className={'globalFilter ' + (locations.length <= 1 ? 'is-empty' : '')}>
                <Select
                    className="globalFilter__component"
                    classNamePrefix="globalFilter"
                    options={locations}
                    value={currentLocation}
                    name={'currentLocation'}
                    getOptionLabel={(option) => option.name}
                    getOptionValue={(option) => option.slug}
                    isSearchable={false}
                    onChange={this.handleCurrentLocation.bind(this)}
                />
            </div>
        )
    }
}
