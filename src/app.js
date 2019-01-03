import GafaThemeSDK from "./components/GafaThemeSDK";
import style from "./css/basic-theme.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'jquery/dist/jquery.min';
import GafaFitSDKWrapper from "./components/utils/GafaFitSDKWrapper";

GafaFitSDKWrapper.initValues();
GafaThemeSDK.renderRegister('#test');