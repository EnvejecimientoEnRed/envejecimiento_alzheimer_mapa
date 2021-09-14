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
let d3_composite = require("d3-composite-projections");

//Necesario para importar los estilos de forma automática en la etiqueta 'style' del html final
import '../css/main.scss';

///// VISUALIZACIÓN DEL GRÁFICO //////
let tooltip = d3.select('#tooltip');

//Variables para visualización
let innerData = [], mapData = [], currentYearData = [], mapBlock = d3.select('#mapBlock');
let svg, colors, projection, path;

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
        setNewValue(currentValue);
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
    updateMap(currentValue);

    if (currentValue == 2019) {
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
        mapData = topojson.feature(topo, topo.objects['spain-provinces']);
        
        //Integramos los datos dentro de las provincias
        mapData.features.map(function(item) {
            let datosProvincia = innerData.filter(function(subItem) {
                if(subItem.ID_PROV == parseInt(item.properties.cod_prov)){
                    return subItem;
                }
            });

            item.properties.data = datosProvincia;
        });
        
        svg = mapBlock.append('svg')
            .attr("height", parseInt(mapBlock.style('height')))
            .attr("width", parseInt(mapBlock.style('width')));
        
        projection = d3_composite.geoConicConformalSpain().scale(2000).fitSize([parseInt(mapBlock.style('width')),parseInt(mapBlock.style('height'))], mapData);
        path = d3.geoPath(projection);

        colors = d3.scaleLinear()
            .domain([0,300])
            .range(['#a7e7e7', '#296161']);

        svg.selectAll('.provincias')
            .data(mapData.features)
            .enter()
            .append('path')
            .attr('class', 'provincias')
            .attr('d', path)
            .style('fill', function(d) {
                let data = d.properties.data.filter(function(item) {
                    if(parseInt(item.Year) == currentValue){
                        return item;
                    }
                });
                return colors(parseInt(data[0].TasaTot65));
            })
            .style('stroke', '#cecece')
            .style('stroke-width', '1px')
            .on('mousemove mouseover', function(d,i,e){
                //Línea diferencial y cambio del polígonos
                let currentProvince = this;
                
                document.getElementsByTagName('svg')[0].removeChild(this);
                document.getElementsByTagName('svg')[0].appendChild(currentProvince);

                currentProvince.style.stroke = '#000';
                currentProvince.style.strokeWidth = '1.5px';

                //Elemento HTML > Tooltip (mostrar nombre de provincia, año y tasas para más de 65 años)

                let dato = d.properties.data.filter(function(item) {
                    if(parseInt(item.Year) == currentValue) {
                        return item;
                    }
                });
                dato = {total: +dato[0].TasaTot65.replace(',','.'), hombres: +dato[0].TasaHom65.replace(',','.'), mujeres: +dato[0].TasaMuj65.replace(',','.')};
                let html = '<p class="chart__tooltip--title">' + d.properties.name + ' (' + currentValue + ')</p>' + '<p class="chart__tooltip--text">Tasa general (65 años o más): ' + numberWithCommas(dato.total.toFixed(1)) + '</p>' + '<p class="chart__tooltip--text">Tasa en hombres (65 años o más): ' + numberWithCommas(dato.hombres.toFixed(1)) + '</p>' + '<p class="chart__tooltip--text">Tasa en mujeres (65 años o más): ' + numberWithCommas(dato.mujeres.toFixed(1)) + '</p>';

                tooltip.html(html);

                //Tooltip
                getInTooltip(tooltip);                
                positionTooltip(window.event, tooltip);
            })
            .on('mouseout', function(d,i,e) {
                //Línea diferencial
                this.style.stroke = '#cecece';
                this.style.strokeWidth = '1px';

                //Desaparición del tooltip
                getOutTooltip(tooltip); 
            })

        //Islas Canarias
        svg.append('path')
            .style('fill', 'none')
            .style('stroke', '#000')
            .attr('d', projection.getCompositionBorders());

        setChartCanvas();
    });
}

function updateMap(year) {
    svg.selectAll('.provincias')
        .style('fill', function(d) {
            let data = d.properties.data.filter(function(item) {
                if(parseInt(item.Year) == year){
                    return item;
                }
            });
            return colors(parseInt(data[0].TasaTot65));
        });

    setChartCanvas();
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