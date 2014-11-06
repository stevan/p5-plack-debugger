#!/usr/bin/env perl

use strict;
use warnings;

use Plack::Builder;

use Plack::Debugger;
use Plack::Debugger::Storage;

use Plack::App::Debugger;

use Plack::Debugger::Panel::Timer;
use Plack::Debugger::Panel::PlackResponse;
use Plack::Debugger::Panel::PlackRequest;
use Plack::Debugger::Panel::PerlConfig;
use Plack::Debugger::Panel::Environment;
use Plack::Debugger::Panel::Parameters;
use Plack::Debugger::Panel::AJAX;
use Plack::Debugger::Panel::ModuleVersions;
use Plack::Debugger::Panel::Memory;
use Plack::Debugger::Panel::Warnings;

my $debugger = Plack::Debugger->new(
    storage => Plack::Debugger::Storage->new( 
        data_dir     => './t/100-lpw-2014-examples/tmp/',
        serializer   => sub { $Plack::App::Debugger::JSON->encode( $_[0] ) },
        deserializer => sub { $Plack::App::Debugger::JSON->decode( $_[0] ) },
        filename_fmt => "%s.json",
    ),
    panels  => [ 
        Plack::Debugger::Panel::Timer->new,
        Plack::Debugger::Panel::PlackResponse->new,
        Plack::Debugger::Panel::PlackRequest->new,
        Plack::Debugger::Panel::PerlConfig->new,
        Plack::Debugger::Panel::Environment->new,
        Plack::Debugger::Panel::Parameters->new,
        Plack::Debugger::Panel::ModuleVersions->new,
        Plack::Debugger::Panel::Memory->new,
        Plack::Debugger::Panel::Warnings->new,
    ]
);

my $debugger_app = Plack::App::Debugger->new( debugger => $debugger );

builder {
    mount '/favicon.ico' => sub { [200,[],[]] };
    mount '/debugger'    => $debugger_app->to_app;
    mount '/'            => builder {
        enable $debugger_app->make_injector_middleware;
        enable $debugger->make_collector_middleware;
        sub {
            warn "Hey there!";
            return [ 
                200, 
                [ 'Content-Type' => 'text/html' ], 
                [q[
                    <html>
                    <head><title>Plack::Debugger - Test 002</title></head>
                    <body><h1>Hello London!</h1></body>
                    </html>
                ]]
            ]
        }
    }
};

