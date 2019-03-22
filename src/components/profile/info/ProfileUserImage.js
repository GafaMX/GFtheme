import React from "react";

class ProfileUserImage extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            image: '',
        };
    }

    render(){
        return(
            <div className="profile-intro__image">
                <img src="{this.state.image}"></img>
            </div>
        )
    }
}

export default ProfileUserImage;