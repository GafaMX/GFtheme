import React from 'react'

export default class ImageSelect extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            file_url: null,
            file: null,
            remove: false,
        };

        this.changeFile = this.changeFile.bind(this);
        this.activateFileClick = this.activateFileClick.bind(this);
        this.updateChanges = this.updateChanges.bind(this);
        this.removePicture = this.removePicture.bind(this);
    }

    getFile() {
        let {file_url} = this.state;
        let {picture} = this.props;
        if (file_url !== null) {
            return file_url;
        }

        return picture;
    }

    changeFile(e) {
        let component = this;
        let input = e.target;

        this.setState({
            file: input.files.length > 0 ? input.files[0] : null,
            file_url: input.files.length > 0 ? URL.createObjectURL(input.files[0]) : null,
        }, () => {
            if (input.files.length > 0) {
                component.setState({
                    remove: false
                }, component.updateChanges);
            }
        });
    }

    removePicture() {
        this.setState({
            file: null,
            file_url: null,
            remove: true,
        }, this.updateChanges);
    }

    updateChanges() {
        let {handleChangePicture} = this.props;
        let {file, remove} = this.state;
        if (typeof handleChangePicture === 'function') {
            handleChangePicture(file, remove);
        }
    }

    activateFileClick() {
        let input = document.getElementById('buq__profile_picture_input');
        input.click();
        // let component = this;
        // this.setState({
        //     file: input.files.length > 0 ? input.files[0] : null,
        //     file_url: input.files.length > 0 ? URL.createObjectURL(input.files[0]) : null,
        // }, () => {
        //     if (input.files.length > 0) {
        //         component.setState({
        //             remove: false
        //         });
        //     }
        // });
    }

    render() {
        return (
            <div className={'buq__profile_picture_wrapper'}>
                <div className={'buq__profile_picture_preview'}>
                    {this.getFile() !== null ? (
                        <a
                            className={'buq__profile_picture_remove'}
                            onClick={this.removePicture}
                        >X</a>) : null}
                    {this.getFile() !== null ? (<img
                        className={'buq__profile_picture_preview_image'}
                        src={this.getFile()}
                        onClick={this.activateFileClick}
                    />) : (
                        <a
                            className={'buq__profile_picture_preview_image_empty_button'}
                            onClick={this.activateFileClick}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" height="34px" viewBox="0 -960 960 960" width="34px" fill="#5f6368"><path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>
                        </a>
                    )}
                </div>
                <div>
                    <input
                        type={'file'}
                        name={'buq__profile_picture_input'}
                        className={'buq__profile_picture_input'}
                        onChange={this.changeFile.bind(this)}
                        id={'buq__profile_picture_input'}
                    />
                </div>
            </div>
        );
    }
}
