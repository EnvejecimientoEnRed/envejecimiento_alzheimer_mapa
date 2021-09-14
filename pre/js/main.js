import { numberWithCommas, numberWithCommas2 } from './helpers';
import { setRRSSLinks } from './rrss';
import { setChartCanvas, setChartCanvasImage } from './canvas-image';
import { getInTooltip, getOutTooltip, positionTooltip } from './tooltip';
import { getIframeParams } from './height';
import './tabs';
import 'url-search-params-polyfill';
//Desarrollo del mapa
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

//Necesario para importar los estilos de forma automática en la etiqueta 'style' del html final
import '../css/main.scss';

///// VISUALIZACIÓN DEL GRÁFICO //////
let tooltip = d3.select('#tooltip');

//Variables para visualización
let innerData = [], currentYearData = [], mapBlock = d3.select('#mapBlock');

///// VISUALIZACIÓN Y LÓGICA ASOCIADA A LA VISUALIZACIÓN /////
//Lógica del slider
let currentValue = 2019;
const firstValue = 1990;
const lastValue = 2019;
const yearsDifference = (lastValue - firstValue) + 1;

let sliderRange = document.getElementById('slider');
let sliderDate = document.getElementById('sliderDate');
let playButton = document.getElementById('btnPlay');
let pauseButton = document.getElementById('btnPause');
let sliderInterval;

/* 
*
* Funciones para configurar el timeslider (en consonancia con los datos del archivo) 
*
*/

function createTimeslider(){
    let size = yearsDifference, step = 1;
    sliderRange.size = size;
    sliderRange.min = firstValue;
    sliderRange.max = lastValue;
    sliderRange.step = step;
    sliderRange.value = lastValue;

    /* Los siguientes eventos tienen la capacidad de modificar lo que se muestra en el mapa */
    playButton.onclick = function () {
        sliderInterval = setInterval(setNewValue,300);
        playButton.style.display = 'none';
        pauseButton.style.display = 'inline-block';    
    }

    pauseButton.onclick = function () {
        clearInterval(sliderInterval);
        playButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
    }

    sliderRange.oninput = function () {
        let currentValue = parseInt(sliderRange.value);
        showSliderDate(currentValue);
        updateMap(map, currentValue);
    }
}

/* Da nuevos valores al slider */
function setNewValue() {
    let value = parseInt(sliderRange.value);
    if(value == lastValue) {
        sliderRange.value = firstValue;
    } else {
        sliderRange.value = value + 1;
    }
    currentValue = sliderRange.value;

    showSliderDate(currentValue);
    updateMap(map, currentValue);

    if (currentValue == 2021) {
        clearInterval(sliderInterval);
        playButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
    }
}

function showSliderDate(currentValue){
    sliderDate.textContent = currentValue;
}

//Lógica del mapa > Por defecto, mostramos el último año con datos (2020)
function initMap() {
    const csv = d3.dsvFormat(";");

    let q = d3.queue();
    q.defer(d3.json, "https://raw.githubusercontent.com/EnvejecimientoEnRed/mapa-alzheimer-viz/main/data/spain-provinces-topo.json");
    q.defer(d3.text, 'https://raw.githubusercontent.com/EnvejecimientoEnRed/mapa-alzheimer-viz/main/data/provincias_alzheimer_year.csv');

    q.await(function(error, topo, data) {
        if (error) throw error;
        innerData = csv.parse(data);

        //Tratamos los polígonos
        let provincias = topojson.feature(topo, topo.objects['spain-provinces']);
        
        //Integramos los datos dentro de las provincias
        provincias.features.map(function(item) {
            let datosProvincia = innerData.filter(function(subItem) {
                console.log(subItem);
                if(subItem.ID_PROV == parseInt(item.properties.cod_prov)){
                    return subItem;
                }
            });

            item.properties.data = datosProvincia;
        });

        console.log(provincias);
        
        //Nos quedamos con un año en concreto > Data
        currentYearData = innerData.filter(function(item) {
            if(item['Year'] == '2019') {
                return item;
            }
        });

        let svg = mapBlock.append('svg').attr("height", mapBlock.clientHeight).attr("width", mapBlock.clientWidth);
        
    });
}

function updateMap(year) {
    console.log(year);
}

//// EJECUCIÓN SLIDER + MAPA /////
initMap();
createTimeslider();

///// REDES SOCIALES /////
setRRSSLinks();

///// ALTURA DEL BLOQUE DEL GRÁFICO //////
getIframeParams();

///// DESCARGA COMO PNG O SVG > DOS PASOS/////
let pngDownload = document.getElementById('pngImage');

pngDownload.addEventListener('click', function(){
    setChartCanvasImage();
});