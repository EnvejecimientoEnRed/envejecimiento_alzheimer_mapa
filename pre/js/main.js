import { numberWithCommas, numberWithCommas2 } from './helpers';
import { setRRSSLinks } from './rrss';
import { setChartCanvas, setChartCanvasImage } from './canvas-image';
import { getInTooltip, getOutTooltip, positionTooltip } from './tooltip';
import { getIframeParams } from './height';
import './tabs';
import 'url-search-params-polyfill';
import * as d3 from 'd3';

//Necesario para importar los estilos de forma automática en la etiqueta 'style' del html final
import '../css/main.scss';

///// VISUALIZACIÓN DEL GRÁFICO //////
let dataSource = 'https://raw.githubusercontent.com/EnvejecimientoEnRed/maternidad-fecundidad-viz/main/data/data_nac_fec.csv';
let tooltip = d3.select('#tooltip');

//Variables para visualización
let innerData = [], currentData = [], ccaaFirstData = [], ccaaSecondData = [],
    chartBlock = d3.select('#chart'), chart, x_c, x_cAxis, y_c, y_cAxis;
let line, path_1, length_1, path_2, length_2;
let enr_color_1 = '#296565', circle_color_1 = '#9E9E9E';
let enr_color_2 = '#e46b4f', circle_color_2 = '#5E5E5E';

///// VISUALIZACIÓN Y LÓGICA ASOCIADA A LA VISUALIZACIÓN /////

initChart();

function initChart() {
    d3.text(dataSource, function (error, d) {
        if (error) throw error;

        let dsv = d3.dsvFormat(';');
        let data = dsv.parse(d);

        data = data.map(function(d){
            return {
                anio: d.anio,
                ccaa: d.ccaa_2,
                ccaa_searchable: d.ccaa_2.replace(/\s/g, '-').replace(/[\(\)\,]/g, '').toLowerCase(),
                nacionalidad: d.nacionalidad,
                edad_media: +d.edad_media_primer_hijo,
                ind_fecundidad: +d.ind_fecundidad
            }           
        });

        innerData = data.slice();

        //Filtramos los datos de España por defecto y la opción de 'ambas nacionalidades'
        let nacData = innerData.filter(function(item){if(item.ccaa_searchable == 'nacional' && item.nacionalidad == 'ambas'){ return item;}});
        currentData = nacData.slice().reverse();

        //Desarrollo del gráfico > Debemos hacer muchas variables genéricas para luego actualizar el gráfico
        let margin = {top: 5, right: 22.5, bottom: 25, left: 24.5};
        let width = parseInt(chartBlock.style('width')) - margin.left - margin.right,
            height = parseInt(chartBlock.style('height')) - margin.top - margin.bottom;

        chart = chartBlock
            .append('svg')
            .lower()
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        //Eje X
        x_c = d3.scaleLinear()
            .domain([23,33])
            .range([0, width])
            .nice();

        x_cAxis = function(g){
            g.call(d3.axisBottom(x_c).ticks(5).tickFormat(function(d) { return numberWithCommas2(d); }))
            g.call(function(g){
                g.selectAll('.tick line')
                    .attr('y1', '0%')
                    .attr('y2', '-' + height + '')
            })
            g.call(function(g){g.select('.domain').remove()});
        }

        chart.append("g")
            .attr("transform", "translate(0," + height + ")")
            .attr('class','x_c-axis')
            .call(x_cAxis);

        //Eje Y
        y_c = d3.scaleLinear()
            .domain([0.75,3.5])
            .range([height,0])
            .nice();
    
        y_cAxis = function(svg){
            svg.call(d3.axisLeft(y_c).ticks(5).tickFormat(function(d) { return numberWithCommas2(d); }))
            svg.call(function(g){
                g.selectAll('.tick line')
                    .attr('class', function(d,i) {
                        if (d == 0) {
                            return 'line-special';
                        }
                    })
                    .attr("x1", '0')
                    .attr("x2", '' + width + '')
            })
            svg.call(function(g){g.select('.domain').remove()})
        }        
        
        chart.append("g")
            .attr('class','y_c-axis')
            .call(y_cAxis);

        //Línea
        line = d3.line()
            .x(function(d) { return x_c(d.edad_media); })
            .y(function(d) { return y_c(d.ind_fecundidad); })
            .curve(d3.curveMonotoneX);

        path_1 = chart.append("path")
            .data([currentData])
            .attr("class", 'line-chart_1')
            .attr("fill", "none")
            .attr("stroke", '' + enr_color_1 + '')
            .attr("stroke-width", '1.5px')
            .attr("d", line);

        length_1 = path_1.node().getTotalLength();

        path_1.attr("stroke-dasharray", length_1 + " " + length_1)
            .attr("stroke-dashoffset", length_1)
            .transition()
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .duration(3000);

        chart.selectAll('circles')
            .data(currentData)
            .enter()
            .append('circle')
            .attr('class', 'circle-chart_2_1')
            .attr("r", function(d,i){
                if(i == 0 || i == currentData.length -1) {
                    return '5'
                } else {
                    return '2.5';
                }
            })
            .attr("cx", function(d) { return x_c(d.edad_media); })
            .attr("cy", function(d) { return y_c(d.ind_fecundidad); })
            .style("fill", function(d,i) { 
                if(i == 0) {
                    return '' + circle_color_1 + '';
                } else if (i == currentData.length - 1) {
                    return '' + circle_color_2 + '';
                } else {
                    return '#fff';
                }
            })
            .style("stroke", function(d,i) {
                if(i == 0 || i == currentData.length -1) {
                    return 'none'
                } else {
                    return '' + enr_color_1 + '';
                }
            })
            .style("stroke-width", function(d,i) {
                if(i == 0 || i == currentData.length -1) {
                    return '0'
                } else {
                    return '0.5';
                }
            })
            .style('opacity', '0')
            .on('mouseenter mousedown mousemove mouseover', function(d, i, e) {                
                //Texto
                let html = '<p class="chart__tooltip--title">' + d.ccaa + ' (' + d.anio + ')</p>' + '<p class="chart__tooltip--text">Edad media a la maternidad en el primer hijo:' + numberWithCommas(d.edad_media.toFixed(1)) + ' años</p>' + '<p class="chart__tooltip--text">Indicador coyuntural de fecundidad:' + numberWithCommas(d.ind_fecundidad.toFixed(1)) + '</p>';

                tooltip.html(html);

                //Tooltip
                positionTooltip(window.event, tooltip);
                getInTooltip(tooltip);               
            })
            .on('mouseout', function(d, i, e) {
                //Quitamos el tooltip
                getOutTooltip(tooltip);                
            })
            .transition()
            .delay(function(d,i) { return i * (3000 / currentData.length - 1)})
            .style('opacity', '1');

        setTimeout(() => {
            setChartCanvas(); 
        }, 4000);
    });
}

function updateChart(ccaa, ccaa2, nac) {
    //Filtrar los datos para quedarse únicamente con los que nos interesan > CCAA Y NACIONALIDAD
    let ccaaData = innerData.filter(function(item) {
        if ((item.ccaa_searchable == ccaa || item.ccaa_searchable == ccaa2) && (item.nacionalidad == nac) && (item.edad_media != 0)) {
            return item;
        }
    });

    currentData = ccaaData.reverse();

    ccaaFirstData = currentData.filter(function(item) {
        if (item.ccaa_searchable == ccaa) {
            return item;
        }
    });

    if(ccaa2 != 'null') {
        ccaaSecondData = currentData.filter(function(item) {
            if (item.ccaa_searchable == ccaa2) {
                return item;
            }
        });
    } else {
        ccaaSecondData = [];
    }

    if(nac == 'extranjera' && (ccaa == 'melilla' || ccaa2 == 'melilla' || ccaa == 'ceuta' || ccaa2 == 'ceuta')) {
        //Modificar el eje Y
        y_c.domain([0.75,7]).nice();
        chart.select(".y_c-axis")
            .call(y_cAxis);
    } else {
        //Modificar el eje Y
        y_c.domain([0.75,3.5]).nice();
        chart.select(".y_c-axis")
            .call(y_cAxis);
    }

    animateChart();
}

function animateChart() {
    //Opción de tener dos líneas
    path_1 = chart.select(".line-chart_1")
        .data([ccaaFirstData])
        .attr("class", 'line-chart_1')
        .attr("fill", "none")
        .attr("stroke", '' + enr_color_1 + '')
        .attr("stroke-width", '1.5px')
        .attr("d", line);

    length_1 = path_1.node().getTotalLength();

    path_1.attr("stroke-dasharray", length_1 + " " + length_1)
        .attr("stroke-dashoffset", length_1)
        .transition()
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .duration(3000);

    chart
        .selectAll('.circle-chart_2_1')
        .remove();

    chart.selectAll('circles')
        .data(ccaaFirstData)
        .enter()
        .append('circle')
        .attr('class', 'circle-chart_2_1')  
        .attr("r", function(d,i){
            if(i == 0 || i == ccaaFirstData.length -1) {
                return '5'
            } else {
                return '2.5';
            }
        })
        .attr("cx", function(d) { return x_c(d.edad_media); })
        .attr("cy", function(d) { return y_c(d.ind_fecundidad); })
        .style("fill", function(d,i) {
            if(i == 0) {
                return '' + circle_color_1 + '';
            } else if (i == ccaaFirstData.length - 1) {
                return '' + circle_color_2 + '';
            } else {
                return '#fff';
            }
        })
        .style("stroke", function(d,i) {
            if(i == 0 || i == ccaaFirstData.length -1) {
                return 'none'
            } else {
                return '' + enr_color_1 + '';
            }
        })
        .style("stroke-width", function(d,i) {
            if(i == 0 || i == ccaaFirstData.length - 1) {
                return '0'
            } else {
                return '0.5';
            }
        })
        .style('opacity', '0')
        .on('mouseenter mousedown mousemove mouseover', function(d, i, e) {                
            //Texto
            let html = '<p class="chart__tooltip--title">' + d.ccaa + ' (' + d.anio + ')</p>' + '<p class="chart__tooltip--text">Edad media a la maternidad en el primer hijo:' + numberWithCommas(d.edad_media.toFixed(1)) + ' años</p>' + '<p class="chart__tooltip--text">Indicador coyuntural de fecundidad:' + numberWithCommas(d.ind_fecundidad.toFixed(1)) + '</p>';

            tooltip.html(html);

            //Tooltip
            positionTooltip(window.event, tooltip);
            getInTooltip(tooltip);               
        })
        .on('mouseout', function(d, i, e) {
            //Quitamos el tooltip
            getOutTooltip(tooltip);                
        })
        .transition()
        .delay(function(d,i) { return i * (3000 / ccaaFirstData.length )})
        .style('opacity', '1');
    
    if(!path_2) {
        initSecondPath(ccaaSecondData);
    } else {
        path_2 = chart.select(".line-chart_2")
            .data([ccaaSecondData])
            .attr("class", 'line-chart_2')
            .attr("fill", "none")
            .attr("stroke", '' + enr_color_2 + '')
            .attr("stroke-width", '1.5px')
            .attr("d", line);

        length_2 = path_2.node().getTotalLength();

        path_2.attr("stroke-dasharray", length_2 + " " + length_2)
            .attr("stroke-dashoffset", length_2)
            .transition()
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .duration(3000);

        chart
            .selectAll('.circle-chart_2_2')
            .remove();
        
        chart.selectAll('circles')
            .data(ccaaSecondData)
            .enter()
            .append('circle')
            .attr('class', 'circle-chart_2_2')        
            .attr("r", function(d,i){
                if(i == 0 || i == ccaaSecondData.length -1) {
                    return '5'
                } else {
                    return '2.5';
                }
            })
            .attr("cx", function(d) { return x_c(d.edad_media); })
            .attr("cy", function(d) { return y_c(d.ind_fecundidad); })
            .style("fill", function(d,i) { 
                if(i == 0) {
                    return '' + circle_color_1 + '';
                } else if (i == ccaaSecondData.length - 1) {
                    return '' + circle_color_2 + '';
                } else {
                    return '#fff';
                }
            })
            .style("stroke", function(d,i) {
                if(i == 0 || i == ccaaSecondData.length - 1) {
                    return 'none'
                } else {
                    return '' + enr_color_2 + '';
                }
            })
            .style("stroke-width", function(d,i) {
                if(i == 0 || i == ccaaSecondData.length - 1) {
                    return '0'
                } else {
                    return '0.5';
                }
            })
            .style('opacity', '0')
            .on('mouseenter mousedown mousemove mouseover', function(d, i, e) {                
                //Texto
                let html = '<p class="chart__tooltip--title">' + d.ccaa + ' (' + d.anio + ')</p>' + '<p class="chart__tooltip--text">Edad media a la maternidad en el primer hijo:' + numberWithCommas(d.edad_media.toFixed(1)) + ' años</p>' + '<p class="chart__tooltip--text">Indicador coyuntural de fecundidad:' + numberWithCommas(d.ind_fecundidad.toFixed(1)) + '</p>';

                tooltip.html(html);

                //Tooltip
                positionTooltip(window.event, tooltip);
                getInTooltip(tooltip);               
            })
            .on('mouseout', function(d, i, e) {
                //Quitamos el tooltip
                getOutTooltip(tooltip);                
            })
            .transition()
            .delay(function(d,i) { return i * (3000 / ccaaSecondData.length )})
            .style('opacity', '1');        
    }
    setTimeout(() => {
        setChartCanvas(); 
    }, 4000);
}

function initSecondPath(data) {
    path_2 = chart.append("path")
        .data([data])
        .attr("class", 'line-chart_2')
        .attr("fill", "none")
        .attr("stroke", '' + enr_color_2 + '')
        .attr("stroke-width", '1.5px')
        .attr("d", line);

    length_2 = path_2.node().getTotalLength();

    path_2.attr("stroke-dasharray", length_2 + " " + length_2)
        .attr("stroke-dashoffset", length_2)
        .transition()
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .duration(3000);

    chart.selectAll('circles')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'circle-chart_2_2')
        .attr("r", function(d,i){
            if(i == 0 || i == data.length - 1) {
                return '5'
            } else {
                return '2.5';
            }
        })
        .attr("cx", function(d) { return x_c(d.edad_media); })
        .attr("cy", function(d) { return y_c(d.ind_fecundidad); })
        .style("fill", function(d,i) { 
            if(i == 0) {
                return '' + circle_color_1 + '';
            } else if (i == data.length - 1) {
                return '' + circle_color_2 + '';
            } else {
                return '#fff';
            }
        })
        .style("stroke", function(d,i) {
            if(i == 0 || i == data.length -1) {
                return 'none'
            } else {
                return '' + enr_color_2 + '';
            }
        })
        .style("stroke-width", function(d,i) {
            if(i == 0 || i == data.length -1) {
                return '0'
            } else {
                return '0.5';
            }
        })
        .style('opacity', '0')
        .on('mouseenter mousedown mousemove mouseover', function(d, i, e) {                
            //Texto
            let html = '<p class="chart__tooltip--title">' + d.ccaa + ' (' + d.anio + ')</p>' + '<p class="chart__tooltip--text">Edad media a la maternidad en el primer hijo:' + numberWithCommas(d.edad_media.toFixed(1)) + ' años</p>' + '<p class="chart__tooltip--text">Indicador coyuntural de fecundidad:' + numberWithCommas(d.ind_fecundidad.toFixed(1)) + '</p>';

            tooltip.html(html);

            //Tooltip
            positionTooltip(window.event, tooltip);
            getInTooltip(tooltip);               
        })
        .on('mouseout', function(d, i, e) {
            //Quitamos el tooltip
            getOutTooltip(tooltip);                
        })
        .transition()
        .delay(function(d,i) { return i * (3000 / data.length )})
        .style('opacity', '1');
}

///// REDES SOCIALES /////
setRRSSLinks();

///// ALTURA DEL BLOQUE DEL GRÁFICO //////
getIframeParams();

///// DESCARGA COMO PNG O SVG > DOS PASOS/////
let pngDownload = document.getElementById('pngImage');

pngDownload.addEventListener('click', function(){
    setChartCanvasImage();
});

///// USO DE SELECTORES //////
let x, i, j, l, ll, selElmnt, a, b, c;
let currentSelected = 'nacional', currentSelected_2 = '', currentSelectedNac = 'ambas';
/* Look for any elements with the class "custom-select": */
x = document.getElementsByClassName("custom-select");
l = x.length;
for (i = 0; i < l; i++) {
  selElmnt = x[i].getElementsByTagName("select")[0];
  ll = selElmnt.length;
  /* For each element, create a new DIV that will act as the selected item: */
  a = document.createElement("DIV");
  a.setAttribute("class", "select-selected");
  a.innerHTML = selElmnt.options[selElmnt.selectedIndex].innerHTML;
  x[i].appendChild(a);
  /* For each element, create a new DIV that will contain the option list: */
  b = document.createElement("DIV");
  b.setAttribute("class", "select-items select-hide");
  for (j = 1; j < ll; j++) {
    /* For each option in the original select element,
    create a new DIV that will act as an option item: */
    c = document.createElement("DIV");
    let valores = selElmnt.options[j].value.split("_");
    c.setAttribute('data-value', valores[0]);
    c.setAttribute('data-type', valores[1]);
    c.innerHTML = selElmnt.options[j].innerHTML;
    c.addEventListener("click", function(e) {
        /* When an item is clicked, update the original select box,
        and the selected item: */
        let y, i, k, s, h, sl, yl;
        s = this.parentNode.parentNode.getElementsByTagName("select")[0];
        sl = s.length;
        h = this.parentNode.previousSibling;
        let elemType = e.target.getAttribute('data-type');
        if(elemType == 'ccaa') {
          //Vamos a dejar en display: none la segunda columna y a quitar la que había previamente (y viceversa)
          document.querySelectorAll('[data-value=' + currentSelected + ']')[1].style.display = 'block';
          document.querySelectorAll('[data-value=' + e.target.getAttribute('data-value') + ']')[1].style.display = 'none';

          currentSelected = e.target.getAttribute('data-value');          
        } else if (elemType == 'ccaa-2') {
          //Vamos a dejar en display: none la primera columna y a quitar la que había previamente (y viceversa)
          if(currentSelected_2 != ''){
            document.querySelectorAll('[data-value=' + currentSelected_2 + ']')[0].style.display = 'block';
          }          
          document.querySelectorAll('[data-value=' + e.target.getAttribute('data-value') + ']')[0].style.display = 'none';

          currentSelected_2 = e.target.getAttribute('data-value');
        } else {
          currentSelectedNac = e.target.getAttribute('data-value');
        }
        updateChart(currentSelected, currentSelected_2, currentSelectedNac);

        for (i = 0; i < sl; i++) {
          if (s.options[i].innerHTML == this.innerHTML) {
            s.selectedIndex = i;
            h.innerHTML = this.innerHTML;
            y = this.parentNode.getElementsByClassName("same-as-selected");
            yl = y.length;
            for (k = 0; k < yl; k++) {
              y[k].removeAttribute("class");
            }
            this.setAttribute("class", "same-as-selected");
            break;
          }
        }
        h.click();
    });
    b.appendChild(c);
  }
  x[i].appendChild(b);
  a.addEventListener("click", function(e) {
    /* When the select box is clicked, close any other select boxes,
    and open/close the current select box: */
    e.stopPropagation();
    closeAllSelect(this);
    this.nextSibling.classList.toggle("select-hide");
    this.classList.toggle("select-arrow-active");
  });
}

document.querySelectorAll('[data-value="nacional"]')[1].style.display = 'none';

function closeAllSelect(elmnt) {
  /* A function that will close all select boxes in the document,
  except the current select box: */
  let x, y, i, xl, yl, arrNo = [];
  x = document.getElementsByClassName("select-items");
  y = document.getElementsByClassName("select-selected");
  xl = x.length;
  yl = y.length;
  for (i = 0; i < yl; i++) {
    if (elmnt == y[i]) {
      arrNo.push(i)
    } else {
      y[i].classList.remove("select-arrow-active");
    }
  }
  for (i = 0; i < xl; i++) {
    if (arrNo.indexOf(i)) {
      x[i].classList.add("select-hide");
    }
  }
}

/* If the user clicks anywhere outside the select box,
then close all select boxes: */
document.addEventListener("click", closeAllSelect);
