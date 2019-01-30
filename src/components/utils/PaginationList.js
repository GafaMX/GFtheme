'use strict';

import React from "react";

class PaginationList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isActive: false,
        };
        this.handleClick = this.handleClick.bind(this);
    }


    handleClick(id, event) {

        let options = this.props.extraOptions ? this.props.extraOptions : {};
        options.per_page = this.props.perpage;

        let currentComponent = this;
        if (typeof id === 'number') {
            options.page = id;
            this.props.getListData(options, function (result) {
                currentComponent.props.updatePaginationData(result);
            });
        }
        if (id === 'past') {
            options.page = this.props.page - 1;
            this.props.getListData(options, function (result) {
                currentComponent.props.updatePaginationData(result);
            });
        }
        if (id === 'next') {
            options.page = this.props.page + 1;
            this.props.getListData(options, function (result) {
                currentComponent.props.updatePaginationData(result);
            });
        }
    }

    getActive(id) {
        return id === this.props.page ? 'active-page' : '';
    }

    firstPage(actual) {
        return actual === 1 ? 'hide-button' : '';
    }

    lastPage(actual) {
        return actual === this.props.allpages ? 'hide-button' : '';
    }

    render() {
        if (this.props.allpages < 2) {
            return false;
        } else {
            let pageElements = [];
            let totalpages = this.props.allpages;
            for (let i = 0; i < totalpages; i++) {
                pageElements.push(
                    <div key={'page-' + i} className={["btn-group mr-2"]}>
                        <button id={i + 1} className={'btn btn-info ' + this.getActive(i + 1)}
                                onClick={(e) => this.handleClick(i + 1, e)}>
                            <a>{i + 1}</a></button>
                    </div>)
            }

            return (
                <section className={'pages-navigation'}>
                    <div className={'pagination-container'}>
                        <div className={"btn-group mr-2"}>
                            <button className={'btn btn-info past-page ' + this.firstPage(this.props.page)}
                                    id={['past']}
                                    onClick={(e) => this.handleClick('past', e)}><a>{['<<']}</a></button>
                        </div>
                        {pageElements}
                        <div className={"btn-group mr-2"}>
                            <button className={'btn btn-info next-page ' + this.lastPage(this.props.page)}
                                    id={['next']}
                                    onClick={(e) => this.handleClick('next', e)}><a> {['>>']}</a></button>
                        </div>
                    </div>
                </section>
            );
        }

    }
}

export default PaginationList;