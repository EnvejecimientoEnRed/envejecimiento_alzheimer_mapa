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
const firstValue = 2002;
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
        sliderInterval = setInterval(setNewValue,1000);
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
    const csv = d3.dsvFormat(",");

    let q = d3.queue();
    q.defer(d3.json, "https://raw.githubusercontent.com/EnvejecimientoEnRed/envejecimiento_alzheimer_mapa/main/data/ccaa_espana.json");
    q.defer(d3.text, 'https://raw.githubusercontent.com/EnvejecimientoEnRed/envejecimiento_alzheimer_mapa/main/data/ccaa_alzheimer_year.csv');

    q.await(function(error, topo, data) {
        if (error) throw error;
        innerData = csv.parse(data);

        //Uso del d3.nest
        let innerData = d3.nest()
            .key(function(d) { return d.Sexo;})
            .entries(innerData);

        let totalData = [], hombresData = [], mujeresData = [];

        for(let i = 0; i < innerData.length; i++) {
            if(innerData[i].key == 'Total') {
                totalData = innerData[i].values.slice();
            }
            if(innerData[i].key == 'Hombres') {
                hombresData = innerData[i].values.slice();
            }
            if(innerData[i].key == 'Mujeres') {
                mujeresData = innerData[i].values.slice();
            }
        }
        

        //Tratamos los polígonos
        mapData = topojson.feature(topo, topo.objects['shapefiles_ccaa_espana']);
        
        //Integramos los datos dentro de las ccaa
        mapData.features.map(function(item) {
            let datosTotalCCAA = totalData.filter(function(subItem) {
                if(parseInt(subItem['ccaa_num']) == parseInt(item.properties.cartodb_id)){
                    return subItem;
                }
            });
            let datosHombresCCAA = hombresData.filter(function(subItem) {
                if(parseInt(subItem['ccaa_num']) == parseInt(item.properties.cartodb_id)){
                    return subItem;
                }
            });
            let datosMujeresCCAA = mujeresData.filter(function(subItem) {
                if(parseInt(subItem['ccaa_num']) == parseInt(item.properties.cartodb_id)){
                    return subItem;
                }
            });

            item.properties.total = datosTotalCCAA;
            item.properties.hombres = datosHombresCCAA;
            item.properties.mujeres = datosMujeresCCAA;
        });
        
        svg = mapBlock.append('svg')
            .attr("height", parseInt(mapBlock.style('height')))
            .attr("width", parseInt(mapBlock.style('width')));
        
        projection = d3_composite.geoConicConformalSpain().scale(2000).fitSize([parseInt(mapBlock.style('width')),parseInt(mapBlock.style('height'))], mapData);
        path = d3.geoPath(projection);

        colors = d3.scaleLinear()
            .domain([0,270])
            .range(['#a7e7e7', '#296161']);

        svg.selectAll('.ccaa')
            .data(mapData.features)
            .enter()
            .append('path')
            .attr('class', 'ccaa')
            .attr('d', path)
            .style('fill', function(d) {
                let data = d.properties.total.filter(function(item) {
                    if(parseInt(item.anyo) == currentValue){
                        return item;
                    }
                });
                return colors(parseInt(data[0].tasa));
            })
            .style('stroke', '#cecece')
            .style('stroke-width', '1px')
            .on('mousemove mouseover', function(d,i,e){
                //Línea diferencial y cambio del polígonos
                let currentCCAA = this;
                
                document.getElementsByTagName('svg')[0].removeChild(this);
                document.getElementsByTagName('svg')[0].appendChild(currentCCAA);

                currentCCAA.style.stroke = '#000';
                currentCCAA.style.strokeWidth = '1.5px';

                //Elemento HTML > Tooltip (mostrar nombre de provincia, año y tasas para más de 65 años)

                let datoTotal = d.properties.total.filter(function(item) {
                    if(parseInt(item.anyo) == currentValue) {
                        return item;
                    }
                });

                let datoHombres = d.properties.hombres.filter(function(item) {
                    if(parseInt(item.anyo) == currentValue) {
                        return item;
                    }
                });

                let datoMujeres = d.properties.mujeres.filter(function(item) {
                    if(parseInt(item.anyo) == currentValue) {
                        return item;
                    }
                });

                let html = '<p class="chart__tooltip--title">' + d.properties.name_1 + ' (' + currentValue + ')</p>' + '<p class="chart__tooltip--text">Tasa general (65 años o más): ' + numberWithCommas(datoTotal[0].tasa) + '</p>' + '<p class="chart__tooltip--text">Tasa en hombres (65 años o más): ' + numberWithCommas(datoHombres[0].tasa) + '</p>' + '<p class="chart__tooltip--text">Tasa en mujeres (65 años o más): ' + numberWithCommas(datoMujeres[0].tasa) + '</p>';

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
    svg.selectAll('.ccaa')
        .style('fill', function(d) {
            let data = d.properties.total.filter(function(item) {
                if(parseInt(item.anyo) == year){
                    return item;
                }
            });
            return colors(parseInt(data[0].tasa));
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