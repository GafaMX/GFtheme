'use strict';

import React from "react";
import GafaThemeSDK from "../GafaThemeSDK";

class PaginationList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            totalElements: this.props.itemsList,
            actualPage: this.props.page,
            itemsperpage: this.props.perpage,
            allpages: [this.props.allpages],
            isActive: false,

        };
        this.handleClick = this.handleClick.bind(this);
    }


    handleClick(id, event) {
        if (typeof id === 'number') {
            this.setState({
                actualPage: id
            });
            GafaThemeSDK.renderStaffList('[data-gf-theme="staff-list"]', 10, id);
        }
        if (id === 'past') {
            this.setState({
                actualPage: this.state.actualPage - 1
            });
            GafaThemeSDK.renderStaffList('[data-gf-theme="staff-list"]', 10, this.state.actualPage - 1);
        }
        if (id === 'next') {
            this.setState({
                actualPage: this.state.actualPage + 1
            });
            GafaThemeSDK.renderStaffList('[data-gf-theme="staff-list"]', 10, this.state.actualPage + 1);
        }
    }

    getActive(id) {
        return id === this.state.actualPage ? 'active-page' : '';
    }

    firstPage(actual) {
        return actual === 1 ? 'hide-button' : '';
    }

    lastPage(actual) {
        return actual === this.props.allpages ? 'hide-button' : '';
    }

    render() {
        let pageElements = [];
        let totalpages = this.state.allpages;
        for (let i = 0; i < totalpages; i++) {
            pageElements.push(<div key={'page-' + i} className={["btn-group mr-2"]}>
                <button key={'page-' + i} id={i + 1} className={'btn btn-info ' + this.getActive(i + 1)}
                        onClick={(e) => this.handleClick(i + 1, e)}>
                    <a>{i + 1}</a></button>
            </div>)
        }

        return (
            <section className={'pages-navigation'}>
                <div className={'pagination-container'}>
                    <div className={"btn-group mr-2"}>
                        <button className={'btn btn-info past-page ' + this.firstPage(this.state.actualPage)}
                                id={['past']}
                                onClick={(e) => this.handleClick('past', e)}><a>{['<<']}</a></button>
                    </div>
                    {pageElements}
                    <div className={"btn-group mr-2"}>
                        <button className={'btn btn-info next-page ' + this.lastPage(this.state.actualPage)}
                                id={['next']}
                                onClick={(e) => this.handleClick('next', e)}><a> {['>>']}</a></button>
                    </div>
                </div>
            </section>
        );
    }

}

export default PaginationList;