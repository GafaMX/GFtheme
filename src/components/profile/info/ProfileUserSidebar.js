import React from "react";
import GlobalStorage from "../../store/GlobalStorage";

class ProfileUserSidebar extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            address: '',
            external_number: '',
            external_number: '',
            internal_number: '',
            municipality: '',
            postal_code: '',
            city: '',
            countries_id: '',
            country_states_id: '',
            phone: '',
            cel_phone: ''
        };

        GlobalStorage.addSegmentedListener(['me'], this.updateAddress.bind(this));
    }

    updateAddress(){
        let me = GlobalStorage.get('me');
        this.setState({
            address: me.address,
            external_number: me.external_number,
            internal_number: me.internal_number,
            municipality: me.municipality,
            postal_code: me.postal_code,
            city: me.city,
            countries_id: me.countries_id,
            country_states_id: me.country_states_id,
            phone: me.phone,
            cel_phone: me.cel_phone
        });
    }

    render(){
        return(
            <div className="profile-intro__sidebar">
                <div className="profile-intro__sidebar-container">
                    <div className="profile-intro__sidebar-address">
                        <h3>Dirección</h3>
                        <p>{this.state.address} {this.state.external_number} {this.state.internal_number},</p>
                        <p>{this.state.municipality}, {this.state.city}</p>
                        <p>{this.state.postal_code}</p>
                        <h3>Télefono Fijo</h3>
                        <p>{this.state.phone}</p>
                        <h3>Télefono Móvil</h3>
                        <p>{this.state.cel_phone}</p>
                    </div>
                    <hr></hr>
                    <div className="profile-intro__sidebar-stats">
                        <h3>Clases Futuras</h3><p>8</p>
                        <hr></hr>
                        <h3>Clases Pasadas</h3><p>8</p>
                        <hr></hr>
                        <h3>Compras</h3><p>8</p>
                        <hr></hr>
                        <h3>Última Clase</h3><p>Lorem Ipsum Dolor</p>
                        <hr></hr>
                        <h3>Próxima Clase</h3><p>Lorem Ipsum Dolor</p>
                        <hr></hr>
                        <h3>Clase Favorita</h3><p>Lorem Ipsum Dolor</p>
                        {/* <hr></hr> */}
                    </div>
                </div>
            </div>
        )
    }
}

export default ProfileUserSidebar;