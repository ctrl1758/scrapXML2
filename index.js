import puppeteer from 'puppeteer';

async function scrapeOrderInfo(xmlId) {
    if (!xmlId) {
        throw new Error('XML ID is required');
    }

    const baseUrl = 'http://deliveryconsole/PDetail.asp';
    const url = `${baseUrl}?paso=&SBO=1-12392468580&DKO=${xmlId}&UserDomain=&UserName=&USER_EMAIL=&back=&MAccountID=81-35Y302W&TaskEQID=0&USERID=0&SOMA_SIID=&base=&RoleName=Sales%20Engineer`;

    let browser = null;
    try {
        console.log("leyendo Pagina XML")
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(30000);
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForSelector('#tabs-1 table[border="1"]');

        const result = await page.evaluate(() => {
            const contenedor = document.querySelector('#tabs-1');
            const table = contenedor.querySelector('table[border="1"]');

            // Extraer encabezados
            const headers = Array.from(table.querySelectorAll('tr:first-child td'))
                .map(td => td.textContent.replace(/\s+/g, ' ').trim());

            // Extraer contenido del primer <font> en el segundo <td>
            const secondTd = document.querySelectorAll('#tblCaberaPrincipal td')[1];
            const fontContent = secondTd
                ? secondTd.querySelector('font')?.textContent.trim()
                : null;

            const tableC = document.querySelector('#tblCaberaPrincipal');
            const siebelOrder = tableC.querySelector('tr:nth-of-type(2) tr:nth-of-type(1) td:nth-of-type(2)')?.innerText.trim();
            const pais = tableC.querySelector('tr:nth-of-type(2) tr:nth-of-type(1) td:nth-of-type(4)')?.innerText.trim();
            const razonSocial = tableC.querySelector('tr:nth-of-type(2) tr:nth-of-type(2) td:nth-of-type(2)')?.innerText.trim();
            const coments2 = tableC.querySelector('tr:nth-of-type(2) tr:nth-of-type(9) td:nth-of-type(2)')?.innerText.trim();
            const se = tableC.querySelector('tr:nth-of-type(2) tr:nth-of-type(10) td:nth-of-type(2)')?.innerText.trim();
            const comentarios = document.querySelector(
                '#tblCaberaPrincipal > tbody > tr:nth-of-type(2) table > tbody > tr:nth-of-type(11) > td:nth-of-type(2) textarea'
            )?.value.trim();


            // Extraer filas de datos
            const rows = Array.from(table.querySelectorAll('tr:not(:first-child)'));
            const dataRows = rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                const values = cells.map((td, index) => {
                    // Si es la última columna, buscar el href del enlace
                    if (index === cells.length - 1) {
                        const link = td.querySelector('a');
                        if (link) {
                            // Extraer la URL del onclick
                            const onclickAttr = link.getAttribute('href') || link.getAttribute('onclick') || '';
                            const match = onclickAttr.match(/['"]([^'"]*guru[^'"]*)['"]/);
                            return match ? match[1] : null;
                        }
                        return null;
                    }
                    // Para las demás columnas, mantener el comportamiento original
                    return td.textContent.replace(/\s+/g, ' ').trim();
                });

                const obj = {};
                headers.forEach((header, index) => {
                    if (values[index] !== undefined) {
                        obj[header] = values[index];
                    }
                });
                return obj;
            });

            return {
                fontContent, // Incluye el contenido extraído del primer <font>
                dataRows,
                siebelOrder,
                pais,
                razonSocial,
                se,
                comentarios,
                coments2
            };


        });

        return {
            success: true,
            data: result.dataRows,
            xml: {
                siebelOrder: result.fontContent,
                pais: result.pais,
                razonSocial: result.razonSocial,
                se: result.se,
                comentarios: result.comentarios,
                coments2: result.coments2
            },// Devuelve el contenido del <font> extraído
            timestamp: new Date().toISOString(),
            xmlId: xmlId
        };

    } catch (error) {
        console.log(`Error scraping data for XML ID ${xmlId}:`, error);
        return {
            success: false,
            error: error.message,
            xmlId: xmlId,
            timestamp: new Date().toISOString()
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function scrapePage(url, index) {
    const httpUrl = url.replace(/^https:\/\//, 'http://');

    const browser = await puppeteer.launch({
        headless: true, // Cambiar a true para ejecución silenciosa
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless:true,
/*         slowMo:500, */
    });

    const page = await browser.newPage();

    try {
        console.log(`Index: ${index}, scraping ${httpUrl}`);
        await page.goto(httpUrl, { waitUntil: 'load' });

        await page.waitForSelector('form.form-horizontal', { timeout: 7000 }); // Espera hasta 10s a que el formulario esté disponible
        // Extraer información principal del formulario
        const formData = await page.evaluate(() => {
    // Seleccionar específicamente el tercer div.col-lg-12
    const thirdSection = document.querySelectorAll('.col-lg-12')[2];
    
    if (!thirdSection) {
        throw new Error('No se encontró la sección específica');
    }

    // Seleccionar específicamente el primer form
    const form = thirdSection.querySelector('.panel .panel-body form.form-horizontal');
    
    if (!form) {
        throw new Error('No se encontró el formulario');
    }

    const result = {
        direccion: '',
        latitud: '',
        longitud: '',
        ubicacion: '',
        instancia: '',
        estado: ''
    };

    // Buscar los elementos dentro del form específico
    const addressInfo = form.querySelector('legend:first-child p');

    if (addressInfo) {
        const text = addressInfo.textContent;
        console.log("Texto completo:", text);
        
        const strongs = addressInfo.querySelectorAll('strong');
        let direccion = '';
        let latitud = '';
        let longitud = '';

        strongs.forEach((strong, index) => {
            const strongText = strong.textContent.trim();
            const nextText = strong.nextSibling ? strong.nextSibling.textContent.trim() : '';
            
            console.log(`Strong ${index}:`, strongText);
            console.log(`Texto siguiente ${index}:`, nextText);
            
            if (strongText.includes('Address')) {
                direccion = nextText;
            } else if (strongText.includes('Latitud')) {
                latitud = nextText;
            } else if (strongText.includes('Longitud')) {
                longitud = nextText;
            }
        });

        result.direccion = direccion;
        result.latitud = latitud;
        result.longitud = longitud;
    }

    // Hacer lo mismo para la ubicación e instancia
    const locationInfo = form.querySelector('legend:nth-child(2) p');

    if (locationInfo) {
        const strongs = locationInfo.querySelectorAll('strong');
        strongs.forEach(strong => {
            const strongText = strong.textContent.trim();
            const nextText = strong.nextSibling ? strong.nextSibling.textContent.trim() : '';
            
            if (strongText.includes('Ubication')) {
                result.ubicacion = nextText;
            } else if (strongText.includes('Instance')) {
                result.instancia = nextText;
            }
        });

        // Capturar el estado y el texto adicional
        const estadoElement = locationInfo.querySelector('.pull-right .p-mr-auto');
        const closeElement = locationInfo.querySelector('.pull-right [ng-if="(!form.isThirdParty || form.responseAmo==1)"]');
        
        let estadoTexto = '';
        if (estadoElement) {
            estadoTexto = estadoElement.textContent.trim();
        }
        
        if (closeElement) {
            // Obtener solo el texto "Close" sin incluir el contenido del span interno
            const closeText = closeElement.childNodes[0].textContent.trim();
            estadoTexto = estadoTexto + ' - ' + closeText;
        }

        result.estado = estadoTexto;

    }

    return result;
});

        // Extrae datos de un conjunto de campos específicos
        const extractFieldData = async (fields) => {
            const data = {};
            for (const field of fields) {
                try {
                    // Esperar a que el selector esté disponible
                    await page.waitForSelector(`#${field}`, { timeout: 3000, visible: true });
                    // Obtener el valor del campo
                    const fieldValue = await page.evaluate((fieldId) => {
                        const element = document.getElementById(fieldId);
                        if (!element) return null;

                        if (element.tagName === 'SELECT') {
                            return element.options[element.selectedIndex]?.text || null;
                        }
                        return element.value || element.textContent.trim();
                    }, field);

                    data[field] = fieldValue;
                } catch (error) {
                    console.warn(`Campo no encontrado: ${field}`, error.message);
                    data[field] = null;
                }
            }
            return data;
        };




        // Campos adicionales para extraer
        const additionalFields = [
            "commitedBW", "accessBW", "portBW", "serviceType",
            "consultationNCD", "cLLIPOP", "lastMile", "accessTSD",
            "technologicalSolution", "quoteNumber", "contactPhone",
            "contactName", "contactEmail", "clientInterface", "commentary",
            "routing"
        ];
        const additionalData = await extractFieldData(additionalFields);

        // Campos de terceros
        const thirdPartyFields = [
            'thirdPartyDKO', 'sideAinterface', 'sideBinterface',
            'accessType', 'provisioningInterval', 'qInq', 'mtu',
            "quotedSubBandwidth", "thirdPartyInformation", "mrc", "nrc"
        ];
        const thirdPartyData = await extractFieldData(thirdPartyFields);
        // Retornar datos completos
        return { formData, additionalData, thirdPartyData };

    } catch (error) {
        console.error(`Error scraping ${httpUrl}:`, error.message);
        return null;
    } finally {
        try {
            await browser.close();
        } catch (closeError) {
            console.error('Error closing browser:', closeError.message);
        }
    }
}


// Función principal
async function main() {
    try {
        const xmlId = '8875343';
        const result = await scrapeOrderInfo(xmlId);

        const allResults = [];

        if (result.success) {
            const dataArray = result.data;

            for (const [index, entry] of dataArray.entries()) {
                const url = entry["SOF/TDG Detail"];
                try {
                    const pageResult = await scrapePage(url, index);
                    allResults.push({ TDG: pageResult });
                } catch (error) {
                    console.error(`Error scraping URL at index ${index}: ${url} - ${error.message}`);
                    allResults.push({ TDG: null, error: error.message });
                }
            }

            // Crear el objeto XML y asignar TDG a instancias
            const XML = {
                TDG: allResults,
                instancias: result.data.map((instancia, index) => ({
                    ...instancia,
                    TDG: allResults[index]?.TDG || null // Asigna el TDG correspondiente o null
                })),
                XML: result.xml
            };

            console.log("outputXML", XML.instancias);
           
        } else {
            console.log('Error:', result.error);
        }
    } catch (error) {
        console.log('Fatal error:', error);
    }
}

main();