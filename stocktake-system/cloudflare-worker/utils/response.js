// Response helpers to ensure consistent CORS and error handling

export const createJsonResponse = (data, request, env, status = 200) => {
    const corsHeaders = getCorsHeaders(request, env);
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
};

export const createErrorResponse = (message, request, env, status = 500) => {
    const corsHeaders = getCorsHeaders(request, env);
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
};

export const createBlobResponse = (blob, filename, contentType, request, env) => {
    const corsHeaders = getCorsHeaders(request, env);
    return new Response(blob, {
        headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`
        }
    });
};

// Get CORS headers based on environment
export const getCorsHeaders = (request, env) => {
    const origin = request.headers.get('Origin');
    const allowedOrigins = env.ALLOWED_ORIGINS
        ? env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:8787', 'http://localhost:3000'];

    const corsHeaders = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400', // 24 hours
    };

    // Only set origin if it's in the allowed list
    if (origin && allowedOrigins.includes(origin)) {
        corsHeaders['Access-Control-Allow-Origin'] = origin;
        corsHeaders['Vary'] = 'Origin';
    }

    return corsHeaders;
};
