# Plack::Debugger

## A new debugging tool for Plack web applications

This is a rethinking of the excellent Plack::Middleware::Debug
module, with the specific intent of providing more flexibility and 
supporting capture of debugging data in as many places as possible.
Specifically we support the following features not easily handled
in the previous module. 

### Capturing AJAX requests

This module is able to capture AJAX requests that are performed 
on a page and then associate them with the current request. 

> **NOTE:** This is currently done using jQuery's global AJAX handlers
> which means it will only capture AJAX requests made through jQuery.
> This is not a limitation, it is possible to capture non-jQuery AJAX
> requests too, but given the ubiquity of jQuery it is unlikely that 
> will be needed. That said, patches are most welcome :) 

### Capturing post-request data

Not all debugging data may be available during the normal lifecycle
of a request, some data is better captured and collated in some kind
of post-request cleanup phase. This module allows you to specify that
code can be run in the `psgix.cleanup` phase, which - if your server
supports it - will happens after the request has been sent to the 
browser. 

### Just capturing data

This module has been designed such that it is possible to just 
collect debugging data and not use the provided javascript UI. 
This will allow data to be collected and viewed using some other 
type of mechanism, for instance it would be possible to collect 
data on a web browsing session and view it in aggregate instead 
of just per-page. 

> **NOTE:** While we currently do not provide any code to do this, 
> the possibilities are pretty endless if you think about it.

## Example Usage

```perl
use Plack::Builder;

use JSON;

use Plack::Debugger;
use Plack::Debugger::Storage;

use Plack::App::Debugger;

use Plack::Debugger::Panel::Timer;
use Plack::Debugger::Panel::AJAX;
use Plack::Debugger::Panel::Memory;
use Plack::Debugger::Panel::Warnings;

my $debugger = Plack::Debugger->new(
    storage => Plack::Debugger::Storage->new(
        data_dir     => '/tmp/debugger_panel',
        serializer   => sub { encode_json( shift ) },
        deserializer => sub { decode_json( shift ) },
        filename_fmt => "%s.json",
    ),
    panels => [
        Plack::Debugger::Panel::Timer->new,     
        Plack::Debugger::Panel::AJAX->new, 
        Plack::Debugger::Panel::Memory->new,
        Plack::Debugger::Panel::Warnings->new   
    ]
);

my $debugger_app = Plack::App::Debugger->new( debugger => $debugger );

builder {
    mount $debugger_app->base_url => $debugger_app->to_app;

    mount '/' => builder {
        enable $debugger_app->make_injector_middleware;
        enable $debugger->make_collector_middleware;
        $app;
    }
};
```

## Acknowledgement

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the author would like to express their gratitude.

## Copyright 

Copyright 2014 (c) Stevan Little <stevan@cpan.org>


