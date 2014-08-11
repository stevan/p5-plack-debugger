
# Plack::Debugger

This is a rethinking of the Plack::Middleware::Debug module 
to support a more modern and dynamic web, specifically AJAX
requests and more in depth profiling data which is not always
available during the normal request lifecycle.

## Basic structure

First the Plack::Debugger is configured, this involves 
registering a number of Debugger::Panel objects, providing a 
temp directory to store serialized Debugger::Panel::Data 
objects in, etc. 

The Debugger::Panel objects can be configured to gather data
in any combination of three ways; before the request, 
after the request or in the cleanup phase. 

As an example, timer data could be gathered by taking a 
timestamp before the request, storing it and then in the 
'after' phase using that timestamp to calculate the overall 
time of the request.

## Middleware

The Plack::Debugger then provides a ->collector middleware
which is used to gather information based on the configuration
of the Debugger::Panel objects. This information is stored 
inside a Debugger::Panel::Data object which gets serialized in 
the very last cleanup handler into the specified temp directory. 

The Plack::Middleware::Debugger middleware can then be used
to actually inject the minimum amount possible into the HTML
DOM of the consuming page (ideally just a Javascript file)
and loads all data via AJAX.

It is possible to use the ->collector middleware and not use 
the UI injecting middleware if you want to use some other 
means of displaying the collected data then the UI provided.

### UI

The Plack::Debugger UI is written exclusively in Javascript
and consumes the data provided from the serialized 
Debugger::Panel::Data objects served via the ->application.

## Application

The Plack::Debugger also provides an ->application component
which is used serve the serialized Debugger::Panel::Data 
objects as JSON, as well as serve other static resources 
needed by the Plack::Debugger UI. Additional metadata may 
also be provided in the JSON returned via the ->application
over and above the pure debug data.

### Associated Requests

Every request is given a $request_id, it is also possible for
a request to have a $parent_request_id, this allows an given 
request to have a unique id ($request_id) and any AJAX requests 
fired on it to be associated with said request via the 
$parent_request_id.

The ->application knows how to associate requests with thier 
parent requests, and this is accounted for in the JSON data 
returned by Debugger::Panel::Data objects.









