import React from  'react';
import "../../styles/newlook/common/GFSDK-com-loading.scss";


export default class Loading extends React.Component{
   constructor(props) {
      super(props);
   }

   render(){
      let preCom = 'GFSDK-com';
      let preComLoading = preCom + '-loading';


      return(
         <div className={preComLoading}>
            <div className={preComLoading + '__container'}>
               <div className={preComLoading + '__dot dot-1'}></div>
               <div className={preComLoading + '__dot dot-2'}></div>
               <div className={preComLoading + '__dot dot-3'}></div>
               <div className={preComLoading + '__dot dot-4'}></div>
            </div>
         </div>
      )
   }

}